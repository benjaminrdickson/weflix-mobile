import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

const GOLD = '#C9A84C';
const CARD_BG = '#8B2A2A';
const R = 16;
const NOTCH_W = 5;
const NOTCH_H = 5;
const NOTCH_COUNT = 11;
const OUTER_SW = 1.5;
const INNER_SW = 0.8;
const INNER_INSET = 5;

function notchPositions(W) {
  const usable = W - 2 * R;
  const slot = usable / NOTCH_COUNT;
  return Array.from({ length: NOTCH_COUNT }, (_, i) => R + slot * i + (slot - NOTCH_W) / 2);
}

function outerPath(W, H) {
  const r = R;
  const xs = notchPositions(W);
  const parts = [`M ${r} 0`];

  // Top edge with notches (left to right, notches dip down into card)
  xs.forEach(x => {
    parts.push(
      `L ${x} 0`,
      `L ${x} ${NOTCH_H}`,
      `L ${x + NOTCH_W} ${NOTCH_H}`,
      `L ${x + NOTCH_W} 0`,
    );
  });
  parts.push(
    `L ${W - r} 0`,
    // Top-right concave corner (center at W,0 — arc sweeps inward)
    `A ${r} ${r} 0 0 0 ${W} ${r}`,
    `L ${W} ${H - r}`,
    // Bottom-right concave corner (center at W,H)
    `A ${r} ${r} 0 0 0 ${W - r} ${H}`,
  );

  // Bottom edge with notches (right to left, notches rise up into card)
  [...xs].reverse().forEach(x => {
    parts.push(
      `L ${x + NOTCH_W} ${H}`,
      `L ${x + NOTCH_W} ${H - NOTCH_H}`,
      `L ${x} ${H - NOTCH_H}`,
      `L ${x} ${H}`,
    );
  });
  parts.push(
    `L ${r} ${H}`,
    // Bottom-left concave corner (center at 0,H)
    `A ${r} ${r} 0 0 0 0 ${H - r}`,
    `L 0 ${r}`,
    // Top-left concave corner (center at 0,0)
    `A ${r} ${r} 0 0 0 ${r} 0 Z`,
  );

  return parts.join(' ');
}

function innerPath(W, H) {
  const s = INNER_INSET;
  const r = Math.max(R - s, 3);
  const x0 = s, y0 = s;
  const x1 = W - s, y1 = H - s;
  return [
    `M ${x0 + r} ${y0}`,
    `L ${x1 - r} ${y0}`,
    `A ${r} ${r} 0 0 0 ${x1} ${y0 + r}`,
    `L ${x1} ${y1 - r}`,
    `A ${r} ${r} 0 0 0 ${x1 - r} ${y1}`,
    `L ${x0 + r} ${y1}`,
    `A ${r} ${r} 0 0 0 ${x0} ${y1 - r}`,
    `L ${x0} ${y0 + r}`,
    `A ${r} ${r} 0 0 0 ${x0 + r} ${y0} Z`,
  ].join(' ');
}

export default function TicketCard({ children, posterWidth = 0, style }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ready = size.w > 0 && size.h > 0;

  return (
    <View
      style={[styles.wrapper, style]}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize(s =>
          s.w === layout.width && s.h === layout.height
            ? s
            : { w: layout.width, h: layout.height }
        )
      }
    >
      {children}
      {ready && (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Path d={outerPath(size.w, size.h)} fill="none" stroke={GOLD} strokeWidth={OUTER_SW} />
          <Path d={innerPath(size.w, size.h)} fill="none" stroke={GOLD} strokeWidth={INNER_SW} />
          {posterWidth > 0 && (
            <Line
              x1={posterWidth}
              y1={R + 4}
              x2={posterWidth}
              y2={size.h - R - 4}
              stroke={GOLD}
              strokeWidth={1}
            />
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: CARD_BG,
    borderRadius: R,
    overflow: 'hidden',
  },
});
