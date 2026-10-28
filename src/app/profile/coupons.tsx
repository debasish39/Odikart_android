import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Svg, {
  Circle,
  Defs,
  Mask,
  Path,
  Rect,
} from "react-native-svg";

import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import api from "../../api/api";
import { colors } from "../../theme/colors";

/* =========================================================
   TYPES
========================================================= */

type IconName = keyof typeof Ionicons.glyphMap;

type Coupon = {
  _id?: string;
  code: string;
  discountType?: "PERCENTAGE" | "FIXED" | string;
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  expiryDate?: string | null;
  isActive?: boolean;
};

type ScratchPoint = {
  x: number;
  y: number;
};

/* =========================================================
   CONSTANTS
========================================================= */

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CARD_HORIZONTAL_MARGIN = 12;

const SCRATCH_WIDTH = Math.min(
  SCREEN_WIDTH - CARD_HORIZONTAL_MARGIN * 2,
  430
);

const SCRATCH_HEIGHT = 220;

const SCRATCH_BRUSH_SIZE = 42;

const REVEAL_THRESHOLD = 42;

/* =========================================================
   HELPERS
========================================================= */

const money = (value: unknown) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatExpiry = (value?: string | null) => {
  if (!value) return "No expiry";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No expiry";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isExpired = (coupon: Coupon) => {
  if (!coupon.expiryDate) return false;

  const expiry = new Date(coupon.expiryDate).getTime();

  return Number.isFinite(expiry) && expiry <= Date.now();
};

const getDiscountText = (coupon: Coupon) => {
  const value = Number(coupon.discountValue || 0);

  if (coupon.discountType === "PERCENTAGE") {
    return `${value}% OFF`;
  }

  return `${money(value)} OFF`;
};

const getDiscountShortText = (coupon: Coupon) => {
  const value = Number(coupon.discountValue || 0);

  if (coupon.discountType === "PERCENTAGE") {
    return `${value}%`;
  }

  return money(value);
};

const getDescription = (coupon: Coupon) => {
  const discount = getDiscountText(coupon);

  const minimum = Number(coupon.minOrderAmount || 0);

  if (minimum > 0) {
    return `${discount} on orders above ${money(minimum)}`;
  }

  return `${discount} on your order`;
};

const getRewardTitle = (coupon: Coupon) => {
  if (coupon.discountType === "PERCENTAGE") {
    return `YOU WON ${Number(coupon.discountValue || 0)}% OFF`;
  }

  return `YOU WON ${money(coupon.discountValue)} OFF`;
};

/* =========================================================
   HAPTIC
========================================================= */

const triggerHaptic = async (
  type:
    | "light"
    | "medium"
    | "success"
    | "selection" = "light"
) => {
  try {
    if (type === "success") {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      return;
    }

    if (type === "medium") {
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      );
      return;
    }

    if (type === "selection") {
      await Haptics.selectionAsync();
      return;
    }

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Light
    );
  } catch {
    // Haptics are optional.
  }
};

/* =========================================================
   SKELETON
========================================================= */

function CouponSkeleton() {
  const opacity = useRef(
    new Animated.Value(0.45)
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonContainer}>
      <Animated.View
        style={[
          styles.skeletonHeader,
          { opacity },
        ]}
      />

      <Animated.View
        style={[
          styles.skeletonHero,
          { opacity },
        ]}
      />

      {[1, 2].map((item) => (
        <Animated.View
          key={item}
          style={[
            styles.skeletonScratchCard,
            { opacity },
          ]}
        >
          <View style={styles.skeletonScratchInner} />

          <View style={styles.skeletonLineLarge} />

          <View style={styles.skeletonLineSmall} />
        </Animated.View>
      ))}
    </View>
  );
}

/* =========================================================
   SCRATCH CARD
========================================================= */

function ScratchCard({
  coupon,
  onCopy,
  disabled = false,
}: {
  coupon: Coupon;
  onCopy: (code: string) => void;
  disabled?: boolean;
}) {
  const [points, setPoints] = useState<ScratchPoint[]>([]);
  const [scratchPercent, setScratchPercent] =
    useState(0);

  const [revealed, setRevealed] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [scratching, setScratching] =
    useState(false);

  const revealScale = useRef(
    new Animated.Value(0.85)
  ).current;

  const revealOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const shine = useRef(
    new Animated.Value(-1)
  ).current;

  const scratchedCells = useRef(
    new Set<string>()
  ).current;

  const lastPoint = useRef<ScratchPoint | null>(
    null
  );

  const cardWidth = SCRATCH_WIDTH;
  const cardHeight = SCRATCH_HEIGHT;
  const expired = isExpired(coupon);
  const unavailable = disabled || expired || coupon.isActive === false;

  const revealCard = useCallback(async () => {
    if (revealed || unavailable) return;

    setRevealed(true);
    setScratchPercent(100);

    await triggerHaptic("success");

    Animated.parallel([
      Animated.spring(revealScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),

      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(shine, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, [
    revealed,
    unavailable,
    revealOpacity,
    revealScale,
    shine,
  ]);

  const addScratchPoint = useCallback(
    (point: ScratchPoint) => {
      if (revealed || unavailable) return;

      const x = Math.max(
        0,
        Math.min(cardWidth, point.x)
      );

      const y = Math.max(
        0,
        Math.min(cardHeight, point.y)
      );

      const gridSize = 24;

      const startX = Math.max(
        0,
        Math.floor(
          (x - SCRATCH_BRUSH_SIZE) /
            gridSize
        )
      );

      const endX = Math.min(
        Math.ceil(cardWidth / gridSize),
        Math.ceil(
          (x + SCRATCH_BRUSH_SIZE) /
            gridSize
        )
      );

      const startY = Math.max(
        0,
        Math.floor(
          (y - SCRATCH_BRUSH_SIZE) /
            gridSize
        )
      );

      const endY = Math.min(
        Math.ceil(cardHeight / gridSize),
        Math.ceil(
          (y + SCRATCH_BRUSH_SIZE) /
            gridSize
        )
      );

      for (
        let gridX = startX;
        gridX <= endX;
        gridX++
      ) {
        for (
          let gridY = startY;
          gridY <= endY;
          gridY++
        ) {
          const cellCenterX =
            gridX * gridSize;

          const cellCenterY =
            gridY * gridSize;

          const distance = Math.sqrt(
            Math.pow(cellCenterX - x, 2) +
              Math.pow(cellCenterY - y, 2)
          );

          if (
            distance <=
            SCRATCH_BRUSH_SIZE * 1.4
          ) {
            scratchedCells.add(
              `${gridX}-${gridY}`
            );
          }
        }
      }

      const totalCells =
        Math.ceil(
          cardWidth / gridSize
        ) *
        Math.ceil(
          cardHeight / gridSize
        );

      const percentage = Math.min(
        100,
        Math.round(
          (scratchedCells.size /
            totalCells) *
            100
        )
      );

      setScratchPercent(
        Math.max(
          scratchPercent,
          percentage
        )
      );

      setPoints((current) => {
        const next = [
          ...current,
          { x, y },
        ];

        if (next.length > 180) {
          return next.slice(-180);
        }

        return next;
      });

      if (
        percentage >=
        REVEAL_THRESHOLD
      ) {
        revealCard();
      }
    },
    [
      cardHeight,
      cardWidth,
      revealCard,
      revealed,
      unavailable,
      scratchedCells,
      scratchPercent,
    ]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !revealed && !unavailable,

        onMoveShouldSetPanResponder: () =>
          !revealed && !unavailable,

        onPanResponderGrant: (event) => {
          if (revealed || unavailable) return;

          setScratching(true);

          const {
            locationX,
            locationY,
          } = event.nativeEvent;

          lastPoint.current = {
            x: locationX,
            y: locationY,
          };

          addScratchPoint({
            x: locationX,
            y: locationY,
          });

          triggerHaptic("light");
        },

        onPanResponderMove: (event) => {
          if (revealed || unavailable) return;

          const {
            locationX,
            locationY,
          } = event.nativeEvent;

          const nextPoint = {
            x: locationX,
            y: locationY,
          };

          const previous =
            lastPoint.current;

          if (previous) {
            const distance = Math.sqrt(
              Math.pow(
                nextPoint.x -
                  previous.x,
                2
              ) +
                Math.pow(
                  nextPoint.y -
                    previous.y,
                  2
                )
            );

            if (distance < 3) {
              return;
            }
          }

          lastPoint.current =
            nextPoint;

          addScratchPoint(
            nextPoint
          );
        },

        onPanResponderRelease: () => {
          setScratching(false);
          lastPoint.current = null;
        },

        onPanResponderTerminate: () => {
          setScratching(false);
          lastPoint.current = null;
        },
      }),
    [addScratchPoint, revealed, unavailable]
  );

  const pathData = useMemo(() => {
    if (!points.length) {
      return "";
    }

    if (points.length === 1) {
      const point = points[0];

      return `
        M ${point.x} ${point.y}
        L ${point.x + 0.1} ${point.y + 0.1}
      `;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  }, [points]);

  const handleCopy = async () => {
    const code = String(
      coupon.code || ""
    ).toUpperCase();

    if (!code) return;

    await Clipboard.setStringAsync(code);

    setCopied(true);

    await triggerHaptic("selection");

    onCopy(code);

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  };

  const expiryText = isExpired(
    coupon
  )
    ? "Expired"
    : coupon.expiryDate
    ? `Valid until ${formatExpiry(
        coupon.expiryDate
      )}`
    : "No expiry";

  return (
    <View
      style={[
        styles.rewardCard,
        unavailable && styles.rewardCardDisabled,
      ]}
    >
      {unavailable ? (
        <View style={styles.expiredOverlay} pointerEvents="none">
          <View style={styles.expiredOverlayIcon}>
            <Ionicons
              name={expired ? "time-outline" : "lock-closed-outline"}
              size={25}
              color="#64748B"
            />
          </View>
          <Text style={styles.expiredOverlayTitle}>
            {expired ? "Offer expired" : "Offer unavailable"}
          </Text>
          <Text style={styles.expiredOverlayText}>
            {expired
              ? "This Odikart reward is no longer valid and cannot be scratched or used."
              : "This reward is currently unavailable."}
          </Text>
          <View style={styles.expiredStatusPill}>
            <Ionicons name="close-circle" size={13} color="#64748B" />
            <Text style={styles.expiredStatusText}>NOT AVAILABLE</Text>
          </View>
        </View>
      ) : null}
      {/* =================================================
          TOP BRANDING
      ================================================= */}

      <View style={[styles.rewardHeader, unavailable && styles.rewardHeaderDisabled]}>
        <View style={styles.rewardBrand}>
          <View style={styles.rewardBrandIcon}>
            <Ionicons
              name="gift"
              size={17}
              color="#FFFFFF"
            />
          </View>

          <View>
            <Text
              style={styles.rewardBrandTitle}
            >
              Odikart Rewards
            </Text>

            <Text
              style={styles.rewardBrandSubtitle}
            >
              Exclusive offer for you
            </Text>
          </View>
        </View>

        <View
          style={styles.limitedBadge}
        >
          <Ionicons
            name={unavailable ? "close-circle" : "sparkles"}
            size={11}
            color={unavailable ? "#64748B" : "#92400E"}
          />

          <Text
            style={[
              styles.limitedBadgeText,
              unavailable && styles.limitedBadgeTextDisabled,
            ]}
          >
            {unavailable ? (expired ? "EXPIRED" : "UNAVAILABLE") : "SPECIAL"}
          </Text>
        </View>
      </View>

      {/* =================================================
          SCRATCH AREA
      ================================================= */}

      <View
        style={[
          styles.scratchWrapper,
          {
            width: cardWidth,
            height: cardHeight,
          },
        ]}
        {...(!unavailable ? panResponder.panHandlers : {})}
      >
        {/* REWARD UNDER SCRATCH */}

        <View
          style={[
            styles.rewardReveal,
            {
              width: cardWidth,
              height: cardHeight,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.revealContent,
              {
                opacity:
                  revealOpacity,
                transform: [
                  {
                    scale:
                      revealScale,
                  },
                ],
              },
            ]}
          >
            <View
              style={styles.winnerIcon}
            >
              <Ionicons
                name="trophy"
                size={26}
                color="#F59E0B"
              />
            </View>

            <Text
              style={styles.youWonText}
            >
              🎉 YOU WON!
            </Text>

            <Text
              style={styles.discountBig}
            >
              {getDiscountShortText(
                coupon
              )}
            </Text>

            <Text
              style={styles.discountOff}
            >
              {coupon.discountType ===
              "PERCENTAGE"
                ? "OFF"
                : "OFF YOUR ORDER"}
            </Text>

            <Text
              style={styles.rewardDescription}
            >
              {getDescription(
                coupon
              )}
            </Text>
          </Animated.View>
        </View>

        {/* =================================================
            SCRATCH MASK
        ================================================= */}

        {!revealed ? (
          <View
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          >
            <Svg
              width={cardWidth}
              height={cardHeight}
            >
              <Defs>
                <Mask
                  id="scratchMask"
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                >
                  <Rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="white"
                  />

                  {pathData ? (
                    <Path
                      d={pathData}
                      stroke="black"
                      strokeWidth={
                        SCRATCH_BRUSH_SIZE
                      }
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ) : null}

                  {points.map(
                    (point, index) => (
                      <Circle
                        key={`${point.x}-${point.y}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={
                          SCRATCH_BRUSH_SIZE /
                          2
                        }
                        fill="black"
                      />
                    )
                  )}
                </Mask>
              </Defs>

              {/* Scratch coating */}

              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="#312E81"
                mask="url(#scratchMask)"
              />

              {/* Metallic shine */}

              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="#FBBF24"
                opacity={0.25}
                mask="url(#scratchMask)"
              />
            </Svg>

            {/* Scratch content */}

            <View
              style={styles.scratchOverlayContent}
              pointerEvents="none"
            >
              <View
                style={styles.scratchGiftCircle}
              >
                <Ionicons
                  name="gift-outline"
                  size={36}
                  color="#FFFFFF"
                />
              </View>

              <Text
                style={styles.scratchTitle}
              >
                SCRATCH TO REVEAL
              </Text>

              <Text
                style={styles.scratchSubtitle}
              >
                Scratch anywhere to reveal
                your exclusive reward
              </Text>

              <View
                style={
                  styles.scratchFinger
                }
              >
                <Ionicons
                  name="hand-left-outline"
                  size={17}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.scratchFingerText
                  }
                >
                  {scratching
                    ? "Keep scratching..."
                    : "Swipe with your finger"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* =================================================
            PROGRESS
        ================================================= */}

        {!revealed ? (
          <View
            style={styles.progressContainer}
            pointerEvents="none"
          >
            <View
              style={
                styles.progressTrack
              }
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      scratchPercent,
                      100
                    )}%`,
                  },
                ]}
              />
            </View>

            <Text
              style={
                styles.progressText
              }
            >
              {scratchPercent}% scratched
            </Text>
          </View>
        ) : null}

        {/* =================================================
            REVEALED CHECK
        ================================================= */}

        {revealed ? (
          <View
            style={styles.revealedBadge}
          >
            <Ionicons
              name="checkmark-circle"
              size={15}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.revealedBadgeText
              }
            >
              REVEALED • ONE TIME
            </Text>
          </View>
        ) : null}
      </View>

      {/* =================================================
          COUPON DETAILS
      ================================================= */}

      <View
        style={styles.couponDetails}
      >
        {revealed ? (
          <>
            <View style={styles.oneTimeNotice}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#4338CA"
              />
              <Text style={styles.oneTimeNoticeText}>
                Your reward is unlocked and ready to use
              </Text>
            </View>

            <Text
              style={styles.revealCodeLabel}
            >
              YOUR COUPON CODE
            </Text>

            <View
              style={styles.codeRow}
            >
              <View
                style={styles.codeContainer}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={17}
                  color="#4338CA"
                />

                <Text
                  style={styles.codeText}
                >
                  {String(
                    coupon.code || ""
                  ).toUpperCase()}
                </Text>
              </View>

              <Pressable
                onPress={handleCopy}
                style={({ pressed }) => [
                  styles.copyButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
              >
                <Ionicons
                  name={
                    copied
                      ? "checkmark"
                      : "copy-outline"
                  }
                  size={17}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.copyButtonText
                  }
                >
                  {copied
                    ? "Copied"
                    : "Copy"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View
            style={styles.hiddenCodeRow}
          >
            <View
              style={
                styles.hiddenCodeIcon
              }
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color="#64748B"
              />
            </View>

            <View
              style={styles.hiddenCodeText}
            >
              <Text
                style={
                  styles.hiddenCodeTitle
                }
              >
                Coupon code hidden
              </Text>

              <Text
                style={
                  styles.hiddenCodeSubtitle
                }
              >
                Scratch the card to unlock
                your code
              </Text>
            </View>
          </View>
        )}

        {/* =================================================
            META
        ================================================= */}

        <View
          style={styles.metaRow}
        >
          <View
            style={styles.metaItem}
          >
            <Ionicons
              name="cart-outline"
              size={15}
              color="#64748B"
            />

            <Text
              style={styles.metaText}
            >
              {Number(
                coupon.minOrderAmount ||
                  0
              ) > 0
                ? `Min. ${money(
                    coupon.minOrderAmount
                  )}`
                : "No minimum"}
            </Text>
          </View>

          <View
            style={styles.metaItem}
          >
            <Ionicons
              name="calendar-outline"
              size={15}
              color="#64748B"
            />

            <Text
              style={styles.metaText}
            >
              {expiryText}
            </Text>
          </View>
        </View>

        {/* MAX DISCOUNT */}

        {coupon.discountType ===
          "PERCENTAGE" &&
        Number(
          coupon.maxDiscount || 0
        ) > 0 ? (
          <View
            style={
              styles.maxDiscountContainer
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={15}
              color="#7C3AED"
            />

            <Text
              style={
                styles.maxDiscountText
              }
            >
              Maximum discount{" "}
              {money(
                coupon.maxDiscount
              )}
            </Text>
          </View>
        ) : null}

        {/* =================================================
            ACTION
        ================================================= */}

        {revealed ? (
          <View
            style={styles.actionRow}
          >
            <Pressable
              onPress={() => {
                router.push(
                  "/cart" as any
                );
              }}
              style={({ pressed }) => [
                styles.applyButton,
                pressed &&
                  styles.buttonPressed,
              ]}
            >
              <Ionicons
                name="cart-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.applyButtonText
                }
              >
                Shop & Apply at Checkout
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        ) : (
          <View
            style={styles.scratchHint}
          >
            <Ionicons
              name="sparkles-outline"
              size={16}
              color="#4338CA"
            />

            <Text
              style={styles.scratchHintText}
            >
              One scratch. One reward. Make it count.
            </Text>
          </View>
        )}

      </View>
    </View>
  );
}

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function CouponsScreen() {
  const [coupons, setCoupons] =
    useState<Coupon[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [copiedCode, setCopiedCode] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD COUPONS
  ======================================================= */

  const loadCoupons = useCallback(
    async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/coupons/available"
          );

        const data =
          response?.data;

        const list =
          Array.isArray(
            data?.coupons
          )
            ? data.coupons
            : Array.isArray(
                data?.data?.coupons
              )
            ? data.data.coupons
            : Array.isArray(
                data?.data
              )
            ? data.data
            : [];

        const validCoupons =
          list.filter(
            (coupon: Coupon) =>
              coupon && coupon.code
          );

        setCoupons(validCoupons);
      } catch (
        requestError: any
      ) {
        console.log(
          "COUPONS PAGE LOAD ERROR:",
          requestError?.response
            ?.data ||
            requestError?.message ||
            requestError
        );

        setCoupons([]);

        setError(
          requestError?.response
            ?.data?.message ||
            "Unable to load coupons right now."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  /* =======================================================
     REFRESH
  ======================================================= */

  const onRefresh =
    useCallback(async () => {
      setRefreshing(true);

      await loadCoupons();
    }, [loadCoupons]);

  /* =======================================================
     COPY
  ======================================================= */

  const copyCoupon =
    useCallback(
      (code: string) => {
        setCopiedCode(code);

        setTimeout(() => {
          setCopiedCode(
            (current) =>
              current === code
                ? null
                : current
          );
        }, 1800);
      },
      []
    );

  /* =======================================================
     ACTIVE COUPONS
  ======================================================= */

  const activeCoupons =
    useMemo(
      () =>
        coupons.filter(
          (coupon) =>
            !isExpired(coupon) &&
            coupon.isActive !== false
        ),
      [coupons]
    );

  const expiredCoupons =
    useMemo(
      () =>
        coupons.filter((coupon) => isExpired(coupon)),
      [coupons]
    );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
      >
        <CouponSkeleton />
      </SafeAreaView>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top"]}
    >
      <View
        style={styles.container}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={styles.header}
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.buttonPressed,
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color="#0F172A"
            />
          </Pressable>

          <View
            style={styles.headerTitleWrap}
          >
            <Text
              style={styles.headerTitle}
            >
              Rewards & Offers
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Scratch. Reveal. Save.
            </Text>
          </View>

          <View
            style={styles.headerRewardIcon}
          >
            <Ionicons
              name="gift-outline"
              size={20}
              color="#4338CA"
            />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                onRefresh
              }
              tintColor={
                colors.primary
              }
            />
          }
          contentContainerStyle={
            styles.content
          }
        >
          {/* =================================================
              HERO
          ================================================= */}

          <View
            style={styles.hero}
          >
            <View
              style={styles.heroGlow}
            />

            <View
              style={
                styles.heroIllustration
              }
            >
              <Text
                style={styles.heroEmoji}
              >
                🎁
              </Text>
            </View>

            <View
              style={styles.heroContent}
            >
              <View
                style={
                  styles.heroSmallBadge
                }
              >
                <Ionicons
                  name="sparkles"
                  size={11}
                  color="#92400E"
                />

                <Text
                  style={
                    styles.heroSmallBadgeText
                  }
                >
                  EXCLUSIVE REWARDS
                </Text>
              </View>

              <Text
                style={styles.heroTitle}
              >
                Scratch. Reveal.
                Save. 🎉
              </Text>

              <Text
                style={
                  styles.heroSubtitle
                }
              >
                You've got rewards waiting.
                Scratch a card and unlock
                your special Odikart offer.
              </Text>
            </View>
          </View>

          {/* =================================================
              HOW IT WORKS
          ================================================= */}

          <View
            style={styles.stepsContainer}
          >
            <Text
              style={styles.stepsTitle}
            >
              How it works
            </Text>

            <View
              style={styles.stepsRow}
            >
              <Step
                number="1"
                icon="gift-outline"
                title="Pick"
                subtitle="Choose a reward"
              />

              <View
                style={styles.stepConnector}
              />

              <Step
                number="2"
                icon="hand-left-outline"
                title="Scratch"
                subtitle="Reveal your offer"
              />

              <View
                style={styles.stepConnector}
              />

              <Step
                number="3"
                icon="cart-outline"
                title="Save"
                subtitle="Use at checkout"
              />
            </View>
          </View>

          {/* =================================================
              SECTION HEADER
          ================================================= */}

          <View
            style={styles.sectionHeader}
          >
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Your rewards
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                {activeCoupons.length >
                0
                  ? `${activeCoupons.length} surprise ${
                      activeCoupons.length ===
                      1
                        ? "reward"
                        : "rewards"
                    } waiting`
                  : "No rewards available right now"}
              </Text>
            </View>

            {activeCoupons.length >
            0 ? (
              <View
                style={
                  styles.rewardCount
                }
              >
                <Text
                  style={
                    styles.rewardCountText
                  }
                >
                  {activeCoupons.length}
                </Text>
              </View>
            ) : null}
          </View>

          {/* =================================================
              ERROR
          ================================================= */}

          {error ? (
            <View
              style={styles.errorCard}
            >
              <View
                style={styles.errorIcon}
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={22}
                  color="#DC2626"
                />
              </View>

              <View
                style={styles.errorContent}
              >
                <Text
                  style={
                    styles.errorTitle
                  }
                >
                  Couldn't load rewards
                </Text>

                <Text
                  style={styles.errorText}
                >
                  {error}
                </Text>

                <Pressable
                  onPress={
                    loadCoupons
                  }
                  style={
                    styles.retryButton
                  }
                >
                  <Ionicons
                    name="refresh-outline"
                    size={15}
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={
                      styles.retryText
                    }
                  >
                    Try again
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* =================================================
              EMPTY
          ================================================= */}

          {!error &&
          activeCoupons.length ===
            0 ? (
            <View
              style={styles.emptyCard}
            >
              <View
                style={
                  styles.emptyGift
                }
              >
                <Ionicons
                  name="gift-outline"
                  size={35}
                  color="#64748B"
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No rewards yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                New scratch rewards will
                appear here when Odikart
                launches a new offer.
              </Text>

              <Pressable
                onPress={onRefresh}
                style={
                  styles.emptyButton
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.emptyButtonText
                  }
                >
                  Check again
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* =================================================
              SCRATCH CARDS
          ================================================= */}

          {!error &&
            activeCoupons.map(
              (coupon, index) => (
                <ScratchCard
                  key={
                    coupon._id ||
                    `${coupon.code}-${index}`
                  }
                  coupon={coupon}
                  onCopy={
                    copyCoupon
                  }
                />
              )
            )}

          {/* =================================================
              EXPIRED OFFERS
          ================================================= */}

          {!error && expiredCoupons.length > 0 ? (
            <>
              <View style={styles.expiredSectionHeader}>
                <View>
                  <Text style={styles.expiredSectionTitle}>Past offers</Text>
                  <Text style={styles.expiredSectionSubtitle}>These rewards have ended</Text>
                </View>
                <View style={styles.expiredCountBadge}>
                  <Text style={styles.expiredCountText}>{expiredCoupons.length}</Text>
                </View>
              </View>

              {expiredCoupons.map((coupon, index) => (
                <ScratchCard
                  key={`expired-${coupon._id || coupon.code}-${index}`}
                  coupon={coupon}
                  disabled
                  onCopy={copyCoupon}
                />
              ))}
            </>
          ) : null}

          {/* =================================================
              FOOTER
          ================================================= */}

          {activeCoupons.length >
          0 ? (
            <View
              style={
                styles.footerHint
              }
            >
              <View
                style={
                  styles.footerIcon
                }
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={17}
                  color="#16A34A"
                />
              </View>

              <View
                style={
                  styles.footerContent
                }
              >
                <Text
                  style={
                    styles.footerTitle
                  }
                >
                  Your reward is safe
                </Text>

                <Text
                  style={
                    styles.footerText
                  }
                >
                  Each offer has its own
                  eligibility and expiry
                  conditions.
                </Text>
              </View>
            </View>
          ) : null}

          <View
            style={styles.bottomSpace}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   STEP COMPONENT
========================================================= */

function Step({
  number,
  icon,
  title,
  subtitle,
}: {
  number: string;
  icon: IconName;
  title: string;
  subtitle: string;
}) {
  return (
    <View
      style={styles.stepItem}
    >
      <View
        style={styles.stepCircle}
      >
        <Ionicons
          name={icon}
          size={17}
          color="#4338CA"
        />

        <View
          style={styles.stepNumber}
        >
          <Text
            style={
              styles.stepNumberText
            }
          >
            {number}
          </Text>
        </View>
      </View>

      <Text
        style={styles.stepTitle}
      >
        {title}
      </Text>

      <Text
        style={styles.stepSubtitle}
      >
        {subtitle}
      </Text>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  /* =======================================================
     SCREEN
  ======================================================= */

  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8FF",
  },

  container: {
    flex: 1,
    backgroundColor: "#F7F8FF",
  },

  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 35,
  },

  /* =======================================================
     HEADER
  ======================================================= */

  header: {
    minHeight: 66,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F8FF",
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E7EBF2",
  },

  headerTitleWrap: {
    flex: 1,
    marginLeft: 11,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
  },

  headerRewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },

  /* =======================================================
     HERO
  ======================================================= */

  hero: {
    minHeight: 155,
    borderRadius: 22,
    padding: 17,
    overflow: "hidden",
    backgroundColor: "#211B66",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4338CA",
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },

  heroGlow: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
    opacity: 0.25,
    right: -50,
    top: -70,
  },

  heroIllustration: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4338CA",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },

  heroEmoji: {
    fontSize: 38,
  },

  heroContent: {
    flex: 1,
    marginLeft: 14,
  },

  heroSmallBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  heroSmallBadgeText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#92400E",
    letterSpacing: 0.5,
  },

  heroTitle: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroSubtitle: {
    marginTop: 6,
    fontSize: 9.5,
    lineHeight: 14,
    color: "#E0E7FF",
  },

  /* =======================================================
     STEPS
  ======================================================= */

  stepsContainer: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8ECF3",
  },

  stepsTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 13,
  },

  stepsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  stepItem: {
    flex: 1,
    alignItems: "center",
  },

  stepCircle: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  stepNumber: {
    position: "absolute",
    right: -4,
    top: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#4338CA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  stepNumberText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  stepTitle: {
    marginTop: 7,
    fontSize: 9.5,
    fontWeight: "900",
    color: "#0F172A",
  },

  stepSubtitle: {
    marginTop: 2,
    fontSize: 7.5,
    color: "#64748B",
    textAlign: "center",
  },

  stepConnector: {
    width: 24,
    height: 1,
    backgroundColor: "#D9E2F0",
    marginTop: 21,
  },

  /* =======================================================
     SECTION
  ======================================================= */

  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 8.5,
    color: "#64748B",
  },

  rewardCount: {
    minWidth: 30,
    height: 27,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },

  rewardCountText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#4338CA",
  },

  /* =======================================================
     REWARD CARD
  ======================================================= */

  rewardCard: {
    marginBottom: 14,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E4E8EF",
    shadowColor: "#0F172A",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },

  rewardHeader: {
    minHeight: 67,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rewardHeaderDisabled: {
    opacity: 0.72,
  },

  rewardBrand: {
    flexDirection: "row",
    alignItems: "center",
  },

  rewardBrandIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#4338CA",
    alignItems: "center",
    justifyContent: "center",
  },

  rewardBrandTitle: {
    marginLeft: 9,
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
  },

  rewardBrandSubtitle: {
    marginLeft: 9,
    marginTop: 2,
    fontSize: 7.5,
    color: "#64748B",
  },

  limitedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  limitedBadgeText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#92400E",
    letterSpacing: 0.4,
  },

  /* =======================================================
     SCRATCH AREA
  ======================================================= */

  scratchWrapper: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#F5F3FF",
  },

  rewardReveal: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },

  revealContent: {
    alignItems: "center",
    justifyContent: "center",
  },

  winnerIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },

  youWonText: {
    marginTop: 7,
    fontSize: 10,
    fontWeight: "900",
    color: "#4338CA",
    letterSpacing: 0.7,
  },

  discountBig: {
    marginTop: 2,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900",
    color: "#0F172A",
  },

  discountOff: {
    marginTop: -2,
    fontSize: 10,
    fontWeight: "900",
    color: "#4338CA",
    letterSpacing: 1.5,
  },

  rewardDescription: {
    marginTop: 6,
    fontSize: 8.5,
    color: "#64748B",
    textAlign: "center",
  },

  scratchOverlayContent: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  scratchGiftCircle: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },

  scratchTitle: {
    marginTop: 9,
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1.3,
  },

  scratchSubtitle: {
    marginTop: 5,
    maxWidth: 230,
    fontSize: 8.5,
    lineHeight: 13,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
  },

  scratchFinger: {
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor:
      "rgba(255,255,255,0.17)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  scratchFingerText: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* =======================================================
     PROGRESS
  ======================================================= */

  progressContainer: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 11,
    flexDirection: "row",
    alignItems: "center",
  },

  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 4,
    backgroundColor:
      "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },

  progressText: {
    marginLeft: 7,
    fontSize: 7,
    fontWeight: "800",
    color: "#FFFFFF",
    minWidth: 70,
    textAlign: "right",
  },

  revealedBadge: {
    position: "absolute",
    right: 11,
    top: 11,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  revealedBadgeText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },

  /* =======================================================
     COUPON DETAILS
  ======================================================= */

  oneTimeNotice: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
    gap: 7,
  },

  oneTimeNoticeText: {
    flex: 1,
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: "700",
    color: "#3730A3",
  },

  couponDetails: {
    padding: 14,
  },

  revealCodeLabel: {
    fontSize: 7.5,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.8,
    marginBottom: 7,
  },

  codeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  codeContainer: {
    flex: 1,
    height: 43,
    borderRadius: 12,
    backgroundColor: "#F4F8FF",
    borderWidth: 1,
    borderColor: "#DCE9FF",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
  },

  codeText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    color: "#0F172A",
  },

  copyButton: {
    height: 43,
    marginLeft: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#4338CA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  copyButtonText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  buttonPressed: {
    opacity: 0.68,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  hiddenCodeRow: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8ECF2",
    flexDirection: "row",
    alignItems: "center",
  },

  hiddenCodeIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  hiddenCodeText: {
    flex: 1,
    marginLeft: 9,
  },

  hiddenCodeTitle: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#334155",
  },

  hiddenCodeSubtitle: {
    marginTop: 2,
    fontSize: 7.5,
    color: "#64748B",
  },

  /* =======================================================
     META
  ======================================================= */

  metaRow: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#EEF1F5",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  metaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    flex: 1,
    marginLeft: 5,
    fontSize: 7.8,
    lineHeight: 11,
    color: "#64748B",
  },

  maxDiscountContainer: {
    marginTop: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#F5F3FF",
    flexDirection: "row",
    alignItems: "center",
  },

  maxDiscountText: {
    marginLeft: 5,
    fontSize: 7.5,
    fontWeight: "700",
    color: "#6D28D9",
  },

  /* =======================================================
     ACTION
  ======================================================= */

  actionRow: {
    marginTop: 12,
  },

  applyButton: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: "#4338CA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  applyButtonText: {
    flex: 1,
    textAlign: "center",
    fontSize: 9.5,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  scratchHint: {
    marginTop: 12,
    minHeight: 41,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  scratchHintText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#4338CA",
  },

  /* =======================================================
     ERROR
  ======================================================= */

  errorCard: {
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
  },

  errorIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },

  errorContent: {
    flex: 1,
    marginLeft: 9,
  },

  errorTitle: {
    fontSize: 10.5,
    fontWeight: "900",
    color: "#991B1B",
  },

  errorText: {
    marginTop: 3,
    fontSize: 8,
    lineHeight: 12,
    color: "#B91C1C",
  },

  retryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  retryText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#4338CA",
  },

  /* =======================================================
     EMPTY
  ======================================================= */

  emptyCard: {
    padding: 28,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EAF1",
    alignItems: "center",
  },

  emptyGift: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
  },

  emptyText: {
    maxWidth: 290,
    marginTop: 6,
    fontSize: 9,
    lineHeight: 14,
    color: "#64748B",
    textAlign: "center",
  },

  emptyButton: {
    marginTop: 16,
    minHeight: 38,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#4338CA",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  emptyButtonText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  /* =======================================================
     EXPIRED / DISABLED REWARD
  ======================================================= */

  rewardCardDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    opacity: 0.92,
  },

  expiredOverlay: {
    position: "absolute",
    zIndex: 20,
    top: 67,
    left: 14,
    right: 14,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: "rgba(241,245,249,0.96)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  expiredOverlayIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  expiredOverlayTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "900",
    color: "#334155",
  },

  expiredOverlayText: {
    marginTop: 5,
    fontSize: 8.5,
    lineHeight: 13,
    color: "#64748B",
    textAlign: "center",
  },

  expiredStatusPill: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  expiredStatusText: {
    fontSize: 7,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.5,
  },

  limitedBadgeTextDisabled: {
    color: "#64748B",
  },

  expiredSectionHeader: {
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  expiredSectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#475569",
  },

  expiredSectionSubtitle: {
    marginTop: 3,
    fontSize: 8,
    color: "#94A3B8",
  },

  expiredCountBadge: {
    minWidth: 28,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  expiredCountText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#64748B",
  },

  /* =======================================================
     FOOTER
  ======================================================= */

  footerHint: {
    marginTop: 2,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
  },

  footerIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  footerContent: {
    flex: 1,
    marginLeft: 9,
  },

  footerTitle: {
    fontSize: 9,
    fontWeight: "900",
    color: "#166534",
  },

  footerText: {
    marginTop: 2,
    fontSize: 7.5,
    lineHeight: 11,
    color: "#15803D",
  },

  bottomSpace: {
    height: 25,
  },

  /* =======================================================
     SKELETON
  ======================================================= */

  skeletonContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
    backgroundColor: "#F7F8FF",
  },

  skeletonHeader: {
    height: 48,
    borderRadius: 13,
    backgroundColor: "#E2E8F0",
    marginBottom: 12,
  },

  skeletonHero: {
    height: 155,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
    marginBottom: 12,
  },

  skeletonScratchCard: {
    height: 370,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
    marginBottom: 14,
    padding: 14,
  },

  skeletonScratchInner: {
    height: 220,
    borderRadius: 18,
    backgroundColor: "#CBD5E1",
  },

  skeletonLineLarge: {
    width: "55%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
    marginTop: 14,
  },

  skeletonLineSmall: {
    width: "75%",
    height: 9,
    borderRadius: 5,
    backgroundColor: "#CBD5E1",
    marginTop: 9,
  },
});