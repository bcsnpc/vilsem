// src/primitives/composer.ts
function isObject(val) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
function deepMerge(base, override) {
  if (override === void 0) return base;
  if (base === void 0) return override;
  if (isObject(base) && isObject(override)) {
    const result = { ...base };
    for (const key of Object.keys(override)) {
      result[key] = deepMerge(base[key], override[key]);
    }
    return result;
  }
  return override;
}
function mergeFragments(fragments) {
  if (!fragments.length) return {};
  const allSeries = [];
  for (const f of fragments) {
    const s = f.option.series;
    if (s === void 0) continue;
    if (Array.isArray(s)) allSeries.push(...s);
    else allSeries.push(s);
  }
  let merged = {};
  for (const f of fragments) {
    merged = deepMerge(merged, f.option);
  }
  if (allSeries.length > 0) {
    merged = { ...merged, series: allSeries };
  }
  const allScales = fragments.flatMap((f) => f.contributions?.scales ?? []);
  if (allScales.length > 0) {
    const xScales = allScales.filter((s) => s.axis === "x");
    const yScales = allScales.filter((s) => s.axis === "y");
    if (xScales.length > 0) {
      merged = {
        ...merged,
        xAxis: deepMerge(merged.xAxis, {
          min: Math.min(...xScales.map((s) => s.min)),
          max: Math.max(...xScales.map((s) => s.max))
        })
      };
    }
    if (yScales.length > 0) {
      merged = {
        ...merged,
        yAxis: deepMerge(merged.yAxis, {
          min: Math.min(...yScales.map((s) => s.min)),
          max: Math.max(...yScales.map((s) => s.max))
        })
      };
    }
  }
  const allLegendItems = fragments.flatMap((f) => f.contributions?.legendItems ?? []);
  if (allLegendItems.length > 0) {
    const legendData = allLegendItems.map(
      (item) => item.color ? { name: item.name, itemStyle: { color: item.color } } : { name: item.name }
    );
    merged = { ...merged, legend: deepMerge(merged.legend, { data: legendData }) };
  }
  return merged;
}

// src/primitives/cartesian-frame/index.ts
var CartesianFrame = (props) => {
  const { orientation = "horizontal", margin = {} } = props;
  const { left = 4, right = 16, top = 4, bottom = 4 } = margin;
  const baseAxis = {
    show: true,
    axisLine: { show: false },
    axisTick: { show: false }
  };
  const valueAxis = { ...baseAxis, splitLine: { show: false } };
  const categoryAxis = { ...baseAxis, splitLine: { show: false } };
  const xAxis = orientation === "vertical" ? categoryAxis : valueAxis;
  const yAxis = orientation === "vertical" ? valueAxis : { ...categoryAxis, inverse: true };
  return {
    option: {
      grid: [{ left, right, top, bottom, containLabel: true }],
      xAxis,
      yAxis
    }
  };
};

// src/shared/formatters.js
function fmtVal(v, prefix, suffix) {
  if (v == null) return "\u2014";
  let s;
  if (Math.abs(v) >= 1e9) s = (v / 1e9).toFixed(1) + "B";
  else if (Math.abs(v) >= 1e6) s = (v / 1e6).toFixed(1) + "M";
  else if (Math.abs(v) >= 1e3) s = (v / 1e3).toFixed(1) + "k";
  else if (Number.isInteger(v)) s = v.toLocaleString();
  else s = parseFloat(v.toFixed(2)).toLocaleString();
  return `${prefix || ""}${s}${suffix || ""}`;
}
function fmtAxisNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  const compact = (scale) => Number((n / scale).toPrecision(6));
  if (Math.abs(n) >= 1e9) return `${compact(1e9)}B`;
  if (Math.abs(n) >= 1e6) return `${compact(1e6)}M`;
  if (Math.abs(n) >= 1e3) return `${compact(1e3)}k`;
  return n.toLocaleString(void 0, { maximumSignificantDigits: 6 });
}
function truncateAxisLabel(label, maxLen = 24) {
  const text = String(label || "");
  return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

// src/primitives/categorical-axis/index.ts
var CategoricalAxis = (props, ctx) => {
  const { axis, categories, show = true, labelMaxLength = 24, labelWidth } = props;
  const { theme: t } = ctx;
  const maxLen = Math.max(...categories.map((c) => c.length), 0);
  const computedWidth = labelWidth ?? Math.min(Math.max(maxLen * 5.5, 60), 130);
  const isXAxis = axis === "x";
  const axisLabel = {
    color: t.textSecondary,
    fontSize: 11
  };
  if (isXAxis) {
    axisLabel.interval = 0;
    axisLabel.overflow = "break";
    axisLabel.width = 80;
    axisLabel.lineHeight = 13;
  } else {
    axisLabel.width = computedWidth;
    axisLabel.overflow = "truncate";
  }
  const axisConfig = {
    type: "category",
    data: categories.map((c) => truncateAxisLabel(c, labelMaxLength)),
    show,
    axisLabel
  };
  return { option: isXAxis ? { xAxis: axisConfig } : { yAxis: axisConfig } };
};

// src/primitives/linear-axis/index.ts
var LinearAxis = (props, ctx) => {
  const { axis, dataMin = 0, dataMax = 100, forceZeroBaseline = true, show = true } = props;
  const { theme: t } = ctx;
  const hasNegative = dataMin < 0;
  const min = forceZeroBaseline && !hasNegative ? 0 : dataMin;
  const axisConfig = {
    type: "value",
    min,
    max: dataMax,
    show,
    axisLabel: {
      color: t.textMuted,
      fontSize: 10,
      formatter: fmtAxisNumber
    }
  };
  return { option: axis === "x" ? { xAxis: axisConfig } : { yAxis: axisConfig } };
};

// src/shared/palettes.js
var PALETTES = {
  teal: { start: "#14B8A6", mid: "#2DD4BF", text: "#14B8A6" },
  blue: { start: "#3B82F6", mid: "#60A5FA", text: "#3B82F6" },
  gold: { start: "#F59E0B", mid: "#FBBF24", text: "#F59E0B" },
  green: { start: "#22C55E", mid: "#4ADE80", text: "#22C55E" },
  purple: { start: "#A855F7", mid: "#C084FC", text: "#A855F7" },
  violet: { start: "#8B5CF6", mid: "#A78BFA", text: "#8B5CF6" },
  rose: { start: "#F43F5E", mid: "#FB7185", text: "#F43F5E" },
  red: { start: "#EF4444", mid: "#F87171", text: "#EF4444" },
  orange: { start: "#F97316", mid: "#FB923C", text: "#F97316" },
  amber: { start: "#F59E0B", mid: "#FCD34D", text: "#F59E0B" }
};
var MULTI_COLORS = ["#14B8A6", "#3B82F6", "#A855F7", "#F59E0B", "#22C55E", "#F43F5E"];
var HEX_RE = /^#([0-9a-fA-F]{3}){1,2}$/;
function lighten(hex, amount = 0.18) {
  const [r, g, b] = hexToRgb(hex);
  const lift = (c) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `#${[lift(r), lift(g), lift(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function synthesizePalette(hex) {
  return { start: hex, mid: lighten(hex, 0.22), text: hex };
}
function pal(scheme) {
  if (typeof scheme === "string" && HEX_RE.test(scheme)) return synthesizePalette(scheme);
  return PALETTES[scheme] || PALETTES.teal;
}
function hexToRgb(hex) {
  const h = (hex || "").replace("#", "").padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
}

// src/primitives/bar-marks/index.ts
function buildGradient(startColor, endColor, horizontal) {
  const [x2, y2] = horizontal ? [1, 0] : [0, 1];
  return {
    type: "linear",
    x: 0,
    y: 0,
    x2,
    y2,
    colorStops: [
      { offset: 0, color: startColor },
      { offset: 1, color: endColor }
    ]
  };
}
function buildMarkLine(refLines, horizontal) {
  if (!refLines.length) return void 0;
  return {
    silent: true,
    symbol: "none",
    data: refLines.map((ref) => ({
      ...horizontal ? { xAxis: ref.val } : { yAxis: ref.val },
      lineStyle: { color: ref.color, type: ref.lineStyle ?? "dashed", width: 1.5 },
      label: { show: true, formatter: ref.label, position: "insideEndTop", color: ref.color, fontSize: 10, rotate: 0 }
    }))
  };
}
var BarMarks = (props, ctx) => {
  const {
    orientation = "horizontal",
    colorScheme,
    gradient = false,
    gradientTo,
    conditionalColor = null,
    rankOpacity = true,
    highlightMax = false,
    orderBy = "desc",
    showBackground = true,
    barRadius = 4,
    maxBarSize = 26,
    animEnabled = true,
    animDuration = 500,
    showDataLabels = true,
    labelPosition = "right",
    dataLabelColor = "auto",
    prefix,
    suffix,
    measureName,
    scrollThreshold = 10,
    refLines = [],
    secondaryData,
    secondaryMeasureName,
    secondaryColor,
    stacked = false,
    categoryColors
  } = props;
  const rows = ctx.data.rows;
  const selectedCat = ctx.selection.selectedCat;
  const { theme: t } = ctx;
  const p = pal(colorScheme);
  const [cr, cg, cb] = hexToRgb(p.start);
  const actualGradientTo = gradientTo || p.mid || p.start;
  const n = rows.length;
  const maxVal = Math.max(...rows.map((r) => Math.abs(Number(r._val) || 0)), 0);
  const horizontal = orientation === "horizontal";
  const isAsc = orderBy === "asc";
  const insideColor = dataLabelColor === "auto" ? "#FFFFFF" : dataLabelColor;
  const outsideColor = dataLabelColor === "auto" ? t.textPrimary : dataLabelColor;
  const radius = horizontal ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0];
  const data = rows.map((row, index) => {
    const val = Number(row._val) || 0;
    const hasSelection = selectedCat != null;
    const isSelected = hasSelection && (Array.isArray(selectedCat) ? selectedCat.includes(String(row._cat)) : String(row._cat) === String(selectedCat));
    const isDimmed = hasSelection && !isSelected;
    const baseColor = gradient ? buildGradient(p.start, actualGradientTo, horizontal) : `rgba(${cr},${cg},${cb},0.80)`;
    const catColor = categoryColors ? categoryColors[String(row._cat)] : void 0;
    let itemStyle;
    if (isDimmed) {
      itemStyle = { color: p.start, opacity: 0.25, borderColor: t.axisLine, borderWidth: 1 };
    } else if (catColor) {
      itemStyle = { color: catColor, borderColor: t.axisLine, borderWidth: 1 };
    } else if (conditionalColor && conditionalColor.threshold != null) {
      const color = val >= conditionalColor.threshold ? conditionalColor.above || p.start : conditionalColor.below || "#F43F5E";
      itemStyle = { color, borderColor: t.axisLine, borderWidth: 1 };
    } else if (highlightMax && val === maxVal) {
      itemStyle = { color: p.start, borderColor: p.start, borderWidth: 2 };
    } else if (rankOpacity) {
      const ratio = isAsc ? index / Math.max(n - 1, 1) : (n - 1 - index) / Math.max(n - 1, 1);
      const opacity = isSelected ? "1.00" : (0.35 + ratio * 0.55).toFixed(2);
      const color = gradient ? buildGradient(p.start, actualGradientTo, horizontal) : `rgba(${cr},${cg},${cb},${opacity})`;
      itemStyle = { color, borderColor: t.axisLine, borderWidth: 1 };
    } else {
      itemStyle = { color: baseColor, borderColor: t.axisLine, borderWidth: 1 };
    }
    if (isSelected) {
      itemStyle = { ...itemStyle, borderColor: p.start, borderWidth: 2, opacity: 1 };
    }
    let label;
    if (showDataLabels && labelPosition === "auto") {
      const isInside = maxVal > 0 && val / maxVal > 0.35;
      label = {
        show: true,
        position: isInside ? "insideRight" : "right",
        color: isInside ? insideColor : outsideColor,
        fontSize: 10,
        fontWeight: 600,
        formatter: () => fmtVal(val, prefix, suffix)
      };
    }
    return { value: val, itemStyle, ...label ? { label } : {} };
  });
  const seriesLabel = (() => {
    if (!showDataLabels || labelPosition === "auto") return { show: false };
    const posMap = {
      right: "right",
      inside: "insideRight",
      top: horizontal ? "right" : "top"
    };
    return {
      show: true,
      position: posMap[labelPosition] ?? "right",
      color: labelPosition === "inside" ? insideColor : outsideColor,
      fontSize: 10,
      fontWeight: 600,
      formatter: (params) => fmtVal(params.value, prefix, suffix)
    };
  })();
  const needsScroll = n >= scrollThreshold;
  const dataZoom = needsScroll ? [{ type: "inside", orient: horizontal ? "vertical" : "horizontal", zoomLock: true }] : void 0;
  const markLine = buildMarkLine(refLines, horizontal);
  const hasSecondary = Array.isArray(secondaryData) && secondaryData.length > 0;
  const stackKey = stacked && hasSecondary ? "total" : void 0;
  const resolvedSecondaryColor = secondaryColor || p.mid || "#3B82F6";
  const secondaryDataItems = hasSecondary ? secondaryData.map((rawVal, index) => {
    const val = Number(rawVal) || 0;
    const primaryItem = data[index]?.itemStyle;
    let opacity = 1;
    const primaryColor = primaryItem?.color;
    if (typeof primaryColor === "string") {
      const m = primaryColor.match(/rgba?\([^,]+,[^,]+,[^,]+,([^)]+)\)/);
      if (m) opacity = parseFloat(m[1]) || 1;
    }
    const [sr, sg, sb] = hexToRgb(resolvedSecondaryColor);
    return {
      value: val,
      itemStyle: {
        color: `rgba(${sr},${sg},${sb},${opacity})`,
        borderColor: primaryItem?.borderColor || t.axisLine,
        borderWidth: primaryItem?.borderWidth || 1
      }
    };
  }) : [];
  const primaryRadius = stackKey ? horizontal ? [0, 0, 0, 0] : [0, 0, 0, 0] : radius;
  const secondaryRadius = horizontal ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0];
  const series = {
    type: "bar",
    name: measureName || "value",
    data,
    stack: stackKey,
    barMaxWidth: maxBarSize,
    itemStyle: { borderRadius: primaryRadius },
    showBackground,
    backgroundStyle: showBackground ? { color: t.shimmerBg } : void 0,
    label: seriesLabel,
    labelLayout: { hideOverlap: true },
    animationDuration: animEnabled ? animDuration : 0,
    animationEasing: "cubicOut",
    ...markLine ? { markLine } : {}
  };
  const seriesArr = [series];
  if (hasSecondary) {
    seriesArr.push({
      type: "bar",
      name: secondaryMeasureName || "secondary",
      data: secondaryDataItems,
      stack: stackKey,
      barMaxWidth: maxBarSize,
      itemStyle: { borderRadius: secondaryRadius },
      // Use the same label config as primary so both slices show value labels
      // when dataLabels is enabled. For 'right' position on stacked bars the
      // secondary label sits at the bar's outer end (total) and the primary's
      // sits inside the primary slice — readable, no overlap.
      label: seriesLabel,
      labelLayout: { hideOverlap: true },
      animationDuration: animEnabled ? animDuration : 0,
      animationEasing: "cubicOut"
    });
  }
  return {
    option: {
      series: seriesArr,
      ...dataZoom ? { dataZoom } : {}
    }
  };
};

// src/primitives/escapeHtml.ts
var escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[char]);

// src/primitives/tooltip/index.ts
var Tooltip = (props, ctx) => {
  const {
    prefix,
    suffix,
    measureName,
    accentColor = "#5EEAD4",
    trigger = "item",
    seriesColors,
    // Content controls (all default to today's behaviour → backward compatible):
    showTitle = true,
    // show the category/title row
    titleText,
    // override the auto title (category name)
    showName = true,
    // show the series/measure label per row
    showValue = true,
    // show the formatted value per row
    showSwatch = true,
    // show the colour dot per row
    fontSize = 11
    // row font size
  } = props;
  const { theme: t } = ctx;
  const bg = t.echartsTooltipBg ?? "#0e0e1c";
  const border = t.echartsTooltipBorder ?? "rgba(255,255,255,0.11)";
  const text = t.echartsTooltipText ?? "#E5E7EB";
  const titleColor = t.textPrimary ?? "#F8FAFC";
  const labelColor = t.echartsLegendText ?? "rgba(255,255,255,0.7)";
  const shadow = typeof bg === "string" && bg.startsWith("#0") ? "0 12px 28px rgba(0,0,0,0.48)" : "0 8px 24px rgba(0,0,0,0.12)";
  return {
    option: {
      tooltip: {
        trigger,
        confine: true,
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const cat = titleText != null && titleText !== "" ? titleText : arr[0]?.name ?? "";
          const rows = arr.filter((p) => p?.value != null).map((p, i) => {
            const seriesName = p?.seriesName || measureName || "Value";
            const formatted = fmtVal(Number(p?.value ?? 0), prefix, suffix);
            const swatchColor = seriesColors?.[i] || p?.color;
            const swatch = showSwatch && swatchColor ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${swatchColor};margin-right:6px;vertical-align:middle"></span>` : "";
            const nameCell = showName || showSwatch ? `<span style="color:${labelColor}">${swatch}${showName ? escapeHtml(seriesName) : ""}</span>` : "";
            const valCell = showValue ? `<span style="color:${accentColor};font-weight:700">${escapeHtml(formatted)}</span>` : "";
            return `<div style="display:flex;justify-content:space-between;gap:16px;font-size:${fontSize}px;padding:2px 0">
                ${nameCell}${valCell}
              </div>`;
          }).join("");
          const titleHtml = showTitle && cat ? `<div style="font-size:${fontSize + 1}px;font-weight:600;color:${titleColor};margin-bottom:6px">${escapeHtml(cat)}</div>` : "";
          return `<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:10px 13px;min-width:160px;box-shadow:${shadow};color:${text}">
            ${titleHtml}${rows}
          </div>`;
        }
      }
    }
  };
};

// src/primitives/legend/index.ts
var Legend = (props, ctx) => {
  const { show, position = "top", items = [], color, fontSize } = props;
  const { theme: t } = ctx;
  const shouldShow = show ?? items.length > 0;
  if (!shouldShow) {
    return { option: { legend: { show: false } } };
  }
  const positionMap = {
    top: { top: 0, left: "center", orient: "horizontal" },
    bottom: { bottom: 0, left: "center", orient: "horizontal" },
    left: { left: 0, top: "center", orient: "vertical" },
    right: { right: 0, top: "center", orient: "vertical" }
  };
  return {
    option: {
      legend: {
        show: true,
        ...positionMap[position],
        textStyle: { color: color || t.textMuted, fontSize: fontSize || 11 },
        data: items.map(
          (item) => item.color ? { name: item.name, itemStyle: { color: item.color } } : item.name
        )
      }
    }
  };
};

// src/primitives/radar-marks/index.ts
var RadarMarks = (props, ctx) => {
  const {
    colorScheme,
    seriesName = "",
    fillOpacity = 0.22,
    strokeWidth = 2,
    showDots = false,
    radarRadius = 68,
    labelFontSize = 9,
    prefix,
    suffix,
    animEnabled = true
  } = props;
  const rows = ctx.data.rows;
  const { theme: t } = ctx;
  const p = pal(colorScheme);
  const indicators = rows.map((r) => ({
    name: String(r._cat ?? ""),
    axisLabel: { show: false }
    // silences ECharts "ticks may not be readable" warning
  }));
  const values = rows.map((r) => Number(r._val) || 0);
  const maxVal = Math.max(...values, 0);
  if (maxVal > 0) {
    for (const ind of indicators) ind.max = maxVal;
  }
  const gridColor = t.gridStroke;
  const labelColor = t.textMuted;
  return {
    option: {
      animation: animEnabled,
      radar: {
        indicator: indicators,
        splitLine: { lineStyle: { color: gridColor } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: gridColor } },
        axisName: { color: labelColor, fontSize: labelFontSize },
        center: ["50%", "50%"],
        radius: `${radarRadius}%`
      },
      series: [{
        type: "radar",
        symbol: showDots ? "circle" : "none",
        symbolSize: showDots ? 6 : 0,
        lineStyle: { color: p.start, width: strokeWidth },
        itemStyle: { color: p.start },
        areaStyle: { color: p.start, opacity: fillOpacity },
        data: [{ value: values, name: seriesName }]
      }],
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        // Theme-aware: pulls bg/border/text/shadow from theme tokens so the radar's
        // multi-row tooltip matches the rest of the app's tooltips in both modes.
        formatter: (params) => {
          const vals = Array.isArray(params.value) ? params.value : [params.value];
          const lines = vals.map((v, i) => {
            const name = indicators[i]?.name ?? "";
            const formatted = fmtVal(v, prefix, suffix);
            return `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;padding:2px 0">
              <span style="color:${t.echartsLegendText}">${escapeHtml(name)}</span>
              <span style="color:${p.start};font-weight:700">${escapeHtml(formatted)}</span>
            </div>`;
          }).join("");
          const shadow = t.canvasBg && t.canvasBg.startsWith("#0") ? "0 12px 28px rgba(0,0,0,0.48)" : "0 8px 24px rgba(0,0,0,0.12)";
          return `<div style="background:${t.echartsTooltipBg};border:1px solid ${t.echartsTooltipBorder};border-radius:10px;padding:10px 13px;min-width:160px;box-shadow:${shadow};color:${t.echartsTooltipText}">${lines}</div>`;
        }
      }
    }
  };
};

// src/primitives/gauge-marks/index.ts
var GaugeMarks = (props, ctx) => {
  const {
    colorScheme,
    min = 0,
    max = 100,
    arcWidth = 10,
    gaugeSize = 80,
    showMinMax = false,
    colorZones = null,
    valueFontSize = 15,
    valueFontWeight = 800,
    valueFontFamily,
    valueColor,
    prefix,
    suffix,
    animEnabled = true
  } = props;
  const rows = ctx.data.rows;
  const { theme: t } = ctx;
  const p = pal(colorScheme);
  const raw = rows[0]?._val;
  const val = raw != null ? Number(raw) : null;
  const displayVal = val != null ? Math.max(min, Math.min(max, val)) : 0;
  let fillColor = p.start;
  if (colorZones && val != null) {
    for (const zone of colorZones) {
      if (val >= zone.from && val <= zone.to) {
        fillColor = zone.color;
        break;
      }
    }
  }
  const trackColor = t.shimmerBg;
  const { width: W, height: H } = ctx.dimensions;
  let gaugeCenter = ["50%", "55%"];
  let gaugeRadius = "45%";
  const fmtLabel = (v) => {
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(v);
  };
  if (W > 0 && H > 0) {
    const pad = Math.ceil(arcWidth / 2) + 6;
    const maxR = Math.floor(Math.min(W / 2 - pad, (H - 2 * pad) / 1.5));
    const R = Math.floor(maxR * (gaugeSize / 100));
    if (R > 0) {
      gaugeCenter = [Math.round(W / 2), Math.round(H / 2 + R / 4)];
      gaugeRadius = R;
    }
  }
  return {
    option: {
      animation: animEnabled,
      series: [{
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min,
        max,
        radius: gaugeRadius,
        center: gaugeCenter,
        // ECharts 5 progress API — filled arc computed automatically from value.
        progress: {
          show: true,
          width: arcWidth,
          roundCap: false,
          clip: false,
          itemStyle: { color: fillColor, borderWidth: 0, borderColor: "transparent" }
        },
        // axisLine = plain background track (single segment, no junction dot)
        axisLine: {
          roundCap: false,
          lineStyle: { width: arcWidth, color: [[1, trackColor]] }
        },
        pointer: { show: false, length: 0, width: 0 },
        // anchor: the center circle from which the pointer extends — explicitly kill it
        anchor: {
          show: false,
          showAbove: false,
          size: 0,
          itemStyle: { color: "transparent", borderWidth: 0 }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        splitNumber: showMinMax ? 4 : 0,
        axisLabel: showMinMax ? {
          show: true,
          color: t.textMuted,
          fontSize: 9,
          distance: -(arcWidth + 22),
          formatter: (v) => v === min || v === max ? fmtLabel(v) : ""
        } : { show: false },
        detail: {
          show: true,
          valueAnimation: animEnabled,
          fontSize: valueFontSize,
          fontWeight: valueFontWeight,
          ...valueFontFamily ? { fontFamily: valueFontFamily } : {},
          color: valueColor || fillColor,
          offsetCenter: [0, "15%"],
          formatter: () => fmtVal(val ?? displayVal, prefix, suffix)
        },
        title: { show: false },
        data: [{ value: displayVal, name: val != null ? String(val) : "" }]
      }]
    }
  };
};

// src/primitives/point-marks/index.ts
var PointMarks = (props, ctx) => {
  const {
    colorScheme,
    dotSize = 16,
    dotSizeMax = 100,
    fillOpacity = 0.75,
    showGrid = true,
    showXAxis = true,
    showYAxis = true,
    showLabels = false,
    animEnabled = true,
    xLabel,
    yLabel
  } = props;
  const rows = ctx.data.rows;
  const { theme: t } = ctx;
  const p = pal(colorScheme);
  const hasZ = rows.some((r) => r._val3 != null);
  const zVals = hasZ ? rows.map((r) => Number(r._val3)) : [];
  const zMin = hasZ ? Math.min(...zVals) : 0;
  const zMax = hasZ ? Math.max(...zVals, 1) : 1;
  const sizeMax = Math.sqrt(dotSizeMax / Math.PI) * 2;
  const symbolSize = hasZ ? (val) => {
    if (zMax === zMin) return dotSize;
    const norm = (val[2] - zMin) / (zMax - zMin);
    return Math.round(dotSize + norm * (sizeMax - dotSize));
  } : dotSize;
  const data = rows.map((r) => ({
    value: [Number(r._val), Number(r._val2 ?? r._val), hasZ ? Number(r._val3) : 1],
    name: String(r._cat ?? "")
  }));
  const axisLabelStyle = { color: t.textMuted, fontSize: 9 };
  const gridStroke = t.gridStroke;
  return {
    option: {
      animation: animEnabled,
      grid: {
        top: 8,
        right: 16,
        bottom: showXAxis ? 28 : 8,
        left: showYAxis ? 8 : 8,
        containLabel: true
      },
      xAxis: {
        type: "value",
        show: showXAxis,
        splitLine: { show: showGrid, lineStyle: { color: gridStroke } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, formatter: fmtAxisNumber }
      },
      yAxis: {
        type: "value",
        show: showYAxis,
        splitLine: { show: showGrid, lineStyle: { color: gridStroke } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, formatter: fmtAxisNumber, width: 36 }
      },
      tooltip: {
        show: true,
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: (params) => {
          const [x, y] = params.value;
          const name = params.name || "";
          const xStr = `${xLabel || "X"}: ${fmtAxisNumber(x)}`;
          const yStr = `${yLabel || "Y"}: ${fmtAxisNumber(y)}`;
          return name ? `${escapeHtml(name)}<br/>${escapeHtml(xStr)}<br/>${escapeHtml(yStr)}` : `${escapeHtml(xStr)}<br/>${escapeHtml(yStr)}`;
        }
      },
      series: [{
        type: "scatter",
        data,
        symbolSize,
        itemStyle: { color: p.start, opacity: fillOpacity },
        label: showLabels ? {
          show: true,
          formatter: (params) => params.name || "",
          position: "top",
          color: t.textMuted,
          fontSize: 9
        } : { show: false }
      }]
    }
  };
};

// src/primitives/treemap-marks/index.ts
var TreemapMarks = (props, ctx) => {
  const {
    colorScheme,
    showLabels = true,
    showValues = false,
    colorMode = "single",
    borderColor = "rgba(0,0,0,0.3)",
    borderWidth = 1,
    borderRadius = 0,
    customColors,
    animEnabled = true,
    prefix = null,
    suffix = null,
    labelColor = "#FFFFFF",
    valueColor = "#94A3B8",
    labelFontSize = 10,
    valueFontSize = 9,
    padding = 0,
    categoryColors
  } = props;
  const rows = ctx.data.rows;
  const { theme: t } = ctx;
  const p = pal(colorScheme);
  const palette = customColors && customColors.length > 0 ? customColors : MULTI_COLORS;
  const sizes = rows.map((r) => Math.abs(Number(r._val ?? 0)));
  const maxSize = sizes.length > 0 ? Math.max(...sizes, 1) : 1;
  const data = rows.map((r, i) => {
    const value = Number(r._val ?? 0);
    const size = Math.abs(value);
    const catName = String(r._cat ?? "");
    const catColor = categoryColors ? categoryColors[catName] : void 0;
    const cellColor = catColor || (colorMode === "multi" ? palette[i % palette.length] : p.start);
    const opacity = colorMode === "gradient" ? 0.4 + size / maxSize * 0.5 : 0.8;
    return {
      name: String(r._cat ?? ""),
      value: size,
      // ECharts treemap uses `value` for tile size
      _rawValue: value,
      // preserve original (may be negative) for tooltip/labels
      itemStyle: {
        color: cellColor,
        opacity,
        borderColor,
        borderWidth,
        borderRadius
      }
    };
  });
  const labelFormatter = (params) => {
    const lines = [];
    if (showLabels) lines.push(`{name|${params.name || ""}}`);
    if (showValues) lines.push(`{value|${fmtVal(params.data?._rawValue ?? params.value, prefix, suffix)}}`);
    return lines.join("\n");
  };
  return {
    option: {
      animation: animEnabled,
      tooltip: {
        show: true,
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: (params) => {
          const name = params.name || "";
          const v = params.data?._rawValue ?? params.value;
          return `${escapeHtml(name)}<br/>${escapeHtml(fmtVal(v, prefix, suffix))}`;
        }
      },
      series: [{
        type: "treemap",
        data,
        // Fill the container by default — ECharts treemap defaults leave a margin
        // for breadcrumb/header that we don't use. `padding` prop overrides if set.
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        width: void 0,
        // let top/bottom/left/right drive sizing
        height: void 0,
        roam: false,
        // disable pan/zoom — flat treemap, no drill
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          show: showLabels || showValues,
          formatter: labelFormatter,
          overflow: "truncate",
          // Rich-text segments give labels and values separate styling
          rich: {
            name: { color: labelColor, fontSize: labelFontSize, fontWeight: 600, lineHeight: labelFontSize + 4 },
            value: { color: valueColor, fontSize: valueFontSize, fontWeight: 500, lineHeight: valueFontSize + 3 }
          }
        },
        itemStyle: {
          // Tile-level itemStyle is per-data-item; this is the series default fallback
          borderColor,
          borderWidth,
          borderRadius
        },
        // Disable visual cues that imply drill-down (we render flat)
        upperLabel: { show: false },
        levels: [{ itemStyle: { borderColor, borderWidth, borderRadius } }]
      }]
    }
  };
};

// src/primitives/pie-marks/index.ts
var PieMarks = (props, ctx) => {
  const {
    colorScheme,
    innerRadius = 52,
    outerRadius = 85,
    paddingAngle = 2,
    cornerRadius = 0,
    customColors,
    strokeColor = "transparent",
    strokeWidth = 0,
    showLegend = true,
    legendPosition = "right",
    legendColor,
    legendFontSize,
    maxLegendItems = 6,
    showLabels = false,
    labelStyle = "percent",
    showCenterText = true,
    centerColor,
    centerFontSize = 22,
    maxValue = 100,
    animEnabled = true,
    prefix = null,
    suffix = null,
    categoryColors
  } = props;
  const rows = ctx.data.rows;
  const { theme: t } = ctx;
  const p = pal(colorScheme);
  const palette = customColors && customColors.length > 0 ? customColors : MULTI_COLORS;
  const isRadialProgress = rows.length === 1 && rows[0]._cat === void 0 && innerRadius > 0;
  const isBottomLegend = legendPosition === "bottom";
  const isTopLegend = legendPosition === "top";
  if (isRadialProgress) {
    const value = Number(rows[0]?._val ?? 0);
    const pct = Math.min(Math.abs(value) / Math.max(maxValue, 1), 1);
    const remainderColor = t.shimmerBg;
    return {
      option: {
        animation: animEnabled,
        // Legend is merged independently of series in the app host. Clear the
        // previous category names when field assignment switches to a scalar.
        legend: { show: false, data: [] },
        series: [{
          type: "pie",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          radius: [`${Math.max(innerRadius - 8, 30)}%`, `${Math.min(outerRadius - 25, 50)}%`],
          center: ["50%", "50%"],
          startAngle: 90,
          // ECharts pie defaults to clockwise from startAngle, so this naturally
          // matches Recharts' startAngle:90 endAngle:-270 (full sweep clockwise from top)
          data: [
            { name: "filled", value: pct, itemStyle: { color: p.start } },
            { name: "remainder", value: 1 - pct, itemStyle: { color: remainderColor } }
          ],
          label: { show: false },
          labelLine: { show: false },
          silent: true,
          // disable hover lift on radial progress
          itemStyle: { borderRadius: cornerRadius, borderColor: "transparent", borderWidth: 0 }
        }],
        // ECharts title — placed at chart center, with built-in alignment that
        // works reliably across re-renders (graphic.elements positioning was offset).
        title: {
          show: showCenterText,
          text: fmtVal(value, prefix, suffix),
          left: "center",
          top: "middle",
          textAlign: "center",
          textVerticalAlign: "middle",
          textStyle: {
            color: centerColor || p.text || p.start,
            fontSize: centerFontSize,
            fontWeight: 800,
            textShadowBlur: 18,
            textShadowColor: `${p.start}66`
          }
        },
        // Explicitly clear any leftover graphic.elements from earlier renders —
        // ECharts setOption merges by default and we previously used graphic.elements
        // for center text, which would otherwise stick around as a duplicate.
        graphic: { elements: [] }
      }
    };
  }
  const data = rows.map((r) => {
    const name = String(r._cat ?? "");
    const catColor = categoryColors ? categoryColors[name] : void 0;
    return {
      name,
      value: Math.abs(Number(r._val ?? 0)),
      // Per-category override wins over the ordered `color: palette` on the series.
      ...catColor ? { itemStyle: { color: catColor } } : {}
    };
  });
  const total = data.reduce((s, d) => s + d.value, 0);
  const legendData = data.slice(0, maxLegendItems).map((d) => d.name);
  const center = !showLegend ? ["50%", "50%"] : isBottomLegend ? ["50%", "40%"] : isTopLegend ? ["50%", "55%"] : ["35%", "50%"];
  const chartBounds = {
    left: 0,
    right: showLegend && !isBottomLegend && !isTopLegend ? "30%" : 0,
    top: showLegend && isTopLegend ? "10%" : 0,
    bottom: showLegend && isBottomLegend ? "20%" : 0
  };
  const labelFormatter = (params) => {
    if (labelStyle === "percent") {
      const pct = total > 0 ? params.value / total * 100 : 0;
      return `${pct.toFixed(0)}%`;
    }
    if (labelStyle === "value") return fmtVal(params.value, prefix, suffix);
    const name = String(params.name || "");
    return name.length > 10 ? name.slice(0, 9) + "\u2026" : name;
  };
  return {
    option: {
      animation: animEnabled,
      color: palette,
      // applied to series in order
      tooltip: {
        show: true,
        trigger: "item",
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: (params) => {
          const pct = total > 0 ? params.value / total * 100 : 0;
          return `${escapeHtml(params.name)}<br/>${escapeHtml(fmtVal(params.value, prefix, suffix))} (${pct.toFixed(1)}%)`;
        }
      },
      // Always emit the legend block with explicit `show` flag — ECharts setOption
      // merges by default, so toggling `legend: undefined` would leave the old legend
      // visible from the previous render. `show: false` properly hides it on re-render.
      legend: {
        show: showLegend,
        type: "scroll",
        orient: isBottomLegend || isTopLegend ? "horizontal" : "vertical",
        ...isBottomLegend ? { bottom: 4, left: "center" } : isTopLegend ? { top: 4, left: "center" } : { right: 8, top: "middle" },
        data: legendData,
        textStyle: { color: legendColor || t.echartsLegendText, fontSize: legendFontSize || 11 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 6,
        pageIconColor: t.textMuted,
        pageTextStyle: { color: t.textMuted, fontSize: 10 }
      },
      series: [{
        type: "pie",
        radius: [`${innerRadius}%`, `${outerRadius}%`],
        ...chartBounds,
        center: ["50%", "50%"],
        startAngle: 90,
        padAngle: paddingAngle,
        data,
        label: showLabels ? {
          show: true,
          position: "inside",
          formatter: labelFormatter,
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: 600
        } : { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: cornerRadius,
          borderColor: strokeColor,
          borderWidth: strokeWidth
        },
        emphasis: {
          scale: true,
          scaleSize: 4
        }
      }],
      // Center text — total of all segments. Uses ECharts `title` (top-level
      // component) which has reliable centering vs graphic.elements (which
      // got drift through ECharts merge between re-renders). `title.left/top`
      // position the title's bounding box, and textAlign/textVerticalAlign
      // anchor the text within that box, so the rendered text sits centered
      // on the (left, top) point regardless of font size or label content.
      title: {
        show: showCenterText && innerRadius > 30 && total > 0,
        text: fmtVal(total, prefix, suffix),
        left: center[0],
        top: center[1],
        textAlign: "center",
        textVerticalAlign: "middle",
        textStyle: {
          color: centerColor || p.text || t.textPrimary,
          fontSize: centerFontSize,
          fontWeight: 800,
          textShadowBlur: 18,
          textShadowColor: `${p.start}66`
        }
      },
      // Explicitly clear any leftover graphic.elements from earlier renders —
      // see same comment in the radial-progress branch above.
      graphic: { elements: [] }
    }
  };
};

// src/primitives/line-marks/index.ts
var LineMarks = (props, ctx) => {
  const {
    colorScheme,
    chartType = "line",
    smooth = false,
    strokeWidth = 2.5,
    fillOpacity = 0.28,
    stacked = false,
    showDots = true,
    dotSize = 2.5,
    showDataLabels = false,
    showGrid = false,
    showXAxis = true,
    showYAxis = false,
    invertY = false,
    showAvgLine = false,
    targetLine = null,
    animEnabled = true,
    prefix = null,
    suffix = null,
    measureName,
    secondaryMeasureName,
    primaryColor,
    secondaryColor
  } = props;
  const rows = ctx.data.rows;
  const { theme: t } = ctx;
  const p = pal(colorScheme);
  const primaryStroke = primaryColor || p.start;
  const secondaryStroke = secondaryColor || p.mid || "#3B82F6";
  const isArea = chartType === "area";
  const hasSecondary = rows.some((r) => r._val2 != null);
  const categories = rows.map((r) => String(r._cat ?? ""));
  const primary = rows.map((r) => r._val == null ? null : Number(r._val));
  const secondary = hasSecondary ? rows.map((r) => r._val2 == null ? null : Number(r._val2)) : [];
  const dotsVisible = showDots;
  const validVals = primary.filter((v) => typeof v === "number" && !isNaN(v));
  const avg = validVals.length > 0 ? validVals.reduce((s, v) => s + v, 0) / validVals.length : 0;
  const markLineData = [];
  if (showAvgLine && validVals.length > 0) {
    markLineData.push({
      yAxis: avg,
      label: { show: true, position: "end", formatter: `Avg ${fmtVal(avg, prefix, suffix)}`, color: "#F59E0B", fontSize: 9 },
      lineStyle: { color: "#F59E0B", type: "dashed", width: 1.5 }
    });
  }
  if (typeof targetLine === "number" && targetLine > 0) {
    markLineData.push({
      yAxis: targetLine,
      label: { show: true, position: "end", formatter: `Target ${fmtVal(targetLine, prefix, suffix)}`, color: "#F43F5E", fontSize: 9 },
      lineStyle: { color: "#F43F5E", type: "dashed", width: 1.5 }
    });
  }
  const buildMarkLine2 = () => markLineData.length > 0 ? { silent: true, symbol: "none", data: markLineData } : { silent: true, symbol: "none", data: [] };
  const stackKey = stacked && hasSecondary ? "total" : void 0;
  const series = [
    {
      type: "line",
      name: measureName || "Value",
      data: primary,
      smooth,
      stack: stackKey,
      lineStyle: { color: primaryStroke, width: strokeWidth },
      itemStyle: { color: primaryStroke },
      symbol: dotsVisible ? "circle" : "none",
      symbolSize: dotSize * 2,
      // ECharts symbolSize is diameter; dotSize is radius
      label: {
        show: showDataLabels,
        position: "top",
        formatter: (params) => fmtVal(params.value, prefix, suffix),
        color: t.textMuted,
        fontSize: 9,
        distance: 8
      },
      areaStyle: isArea ? {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${primaryStroke}${Math.round(fillOpacity * 255).toString(16).padStart(2, "0")}` },
            { offset: 0.92, color: `${primaryStroke}00` }
          ]
        }
      } : void 0,
      markLine: buildMarkLine2(),
      animation: animEnabled
    }
  ];
  if (hasSecondary) {
    series.push({
      type: "line",
      name: secondaryMeasureName || "Secondary",
      data: secondary,
      smooth,
      stack: stackKey,
      // When stacked, secondary becomes a solid line (not dashed) — dashed strokes
      // on stacked areas read as "this is auxiliary" which is misleading once the
      // values cumulate. Solid stroke matches PBI/typical stacked-area conventions.
      lineStyle: stackKey ? { color: secondaryStroke, width: strokeWidth * 0.8 } : { color: secondaryStroke, width: strokeWidth * 0.8, type: "dashed" },
      itemStyle: { color: secondaryStroke },
      symbol: "none",
      areaStyle: isArea ? {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: `${secondaryStroke}${Math.round(fillOpacity * 0.6 * 255).toString(16).padStart(2, "0")}` },
            { offset: 0.92, color: `${secondaryStroke}00` }
          ]
        }
      } : void 0,
      animation: animEnabled
    });
  }
  const axisLabelStyle = { color: t.textMuted, fontSize: 9 };
  const gridStroke = t.gridStroke;
  return {
    option: {
      animation: animEnabled,
      grid: {
        top: 8,
        // Right margin large enough to fit a long month/category label (e.g. "September"
        // is ~60-70px at 9px font). containLabel auto-fits but for category axes with
        // boundaryGap:false the edge label often pokes past the grid — this explicit
        // padding prevents truncation in the worst case.
        right: 60,
        bottom: showXAxis ? 28 : 8,
        left: showYAxis ? 8 : 4,
        containLabel: true
      },
      xAxis: {
        type: "category",
        data: categories,
        show: showXAxis,
        boundaryGap: false,
        // line should start at axis edge
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, hideOverlap: true },
        splitLine: { show: false }
      },
      yAxis: {
        type: "value",
        show: showYAxis,
        // `inverse: true` flips the axis so the smallest value is at top — used by
        // bump charts where _val is a rank (1 = best should sit at the top).
        inverse: invertY,
        splitLine: { show: showGrid, lineStyle: { color: gridStroke, type: "dashed" } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, formatter: fmtAxisNumber, width: 36 }
      },
      // Scroll/zoom via mouse wheel + drag for dense time-series. Inside-type
      // means it activates inside the chart area (no separate slider bar — keeps
      // the visual clean and the drawable area maximal).
      dataZoom: rows.length > 30 ? [{
        type: "inside",
        xAxisIndex: 0,
        zoomLock: false,
        // Start with 100% range visible; user can zoom in by scroll/drag.
        start: 0,
        end: 100
      }] : [],
      tooltip: {
        show: true,
        trigger: "axis",
        backgroundColor: t.echartsTooltipBg,
        borderColor: t.echartsTooltipBorder,
        textStyle: { color: t.echartsTooltipText, fontSize: 12 },
        formatter: (params) => {
          const arr = Array.isArray(params) ? params : [params];
          const cat = arr[0]?.name || "";
          const lines = arr.map((s) => `${s.marker || ""} ${escapeHtml(s.seriesName)}: ${escapeHtml(fmtVal(s.value, prefix, suffix))}`).join("<br/>");
          return cat ? `${escapeHtml(cat)}<br/>${lines}` : lines;
        }
      },
      series
    }
  };
};
export {
  BarMarks,
  CartesianFrame,
  CategoricalAxis,
  GaugeMarks,
  Legend,
  LineMarks,
  LinearAxis,
  PieMarks,
  PointMarks,
  RadarMarks,
  Tooltip,
  TreemapMarks,
  mergeFragments
};
//# sourceMappingURL=primitives.js.map
