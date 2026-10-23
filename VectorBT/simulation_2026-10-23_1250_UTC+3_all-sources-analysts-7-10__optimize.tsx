import {
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
  useMemo,
  type CSSProperties,
} from "cursor/canvas";

const SOURCE = "all_sources-7d-window \u00b7 2026-01-12 \u2192 2026-10-22 \u00b7 197 trading days \u00b7 $5,000 per lot. Days exposed are calendar days with at least one lot open. Lot-days add each lot's calendar hold, so overlapping lots count again.";

const ANALYSTS = [5, 7, 8, 9, 10];
const UPSIDES = [20, 25, 30];
const HOLDS = [10, 15, 30];
const TARGETS = [25, 50];
const DROPS = [7.5, 10];

type Buy = { a: number; p: number; n: number; sym: number };
type Sell = { h: number; t: number; d: number };

const BUYS: Buy[] = [{"a":7,"p":20,"n":343,"sym":122},{"a":7,"p":25,"n":242,"sym":88},{"a":7,"p":30,"n":170,"sym":59},{"a":8,"p":20,"n":277,"sym":101},{"a":8,"p":25,"n":203,"sym":77},{"a":8,"p":30,"n":141,"sym":53},{"a":9,"p":20,"n":237,"sym":90},{"a":9,"p":25,"n":174,"sym":64},{"a":9,"p":30,"n":121,"sym":46},{"a":10,"p":20,"n":199,"sym":79},{"a":10,"p":25,"n":148,"sym":57},{"a":10,"p":30,"n":102,"sym":38},{"a":5,"p":20,"n":587,"sym":169}];
const SELLS: Sell[] = [{"h":10,"t":25,"d":7.5},{"h":10,"t":25,"d":10},{"h":10,"t":50,"d":7.5},{"h":10,"t":50,"d":10},{"h":15,"t":25,"d":7.5},{"h":15,"t":25,"d":10},{"h":15,"t":50,"d":7.5},{"h":15,"t":50,"d":10},{"h":30,"t":25,"d":7.5},{"h":30,"t":25,"d":10},{"h":30,"t":50,"d":7.5},{"h":30,"t":50,"d":10}];
const ROI: number[][] = [[13.2117,8.2664,3.7781,-0.5644,12.2774,3.9632,0.6097,-6.9731,1.9885,-10.0025,-6.3017,-17.3273],[4.9001,0.1589,-7.3336,-11.3307,0.0456,-7.7895,-16.5069,-22.5493,-8.7838,-22.0346,-19.6614,-30.3395],[6.8436,1.2162,-5.9173,-9.7682,1.1975,-7.284,-20.8971,-26.4209,-2.4499,-21.8021,-17.7919,-32.8288],[15.8397,9.1138,3.0405,-3.2689,15.9417,5.6034,0.9735,-8.5369,4.0767,-8.7158,-6.7979,-18.5185],[10.5315,3.5902,-2.9428,-9.7234,5.6883,-4.5933,-12.6276,-21.2646,-4.4551,-18.8379,-16.4414,-28.3496],[15.4204,6.9365,3.9629,-3.6756,9.9094,-1.8525,-12.6232,-21.9201,4.8451,-17.1053,-10.4144,-28.3642],[12.7,4.6965,-1.4671,-10.1241,14.7255,3.4751,-4.2478,-15.9142,2.8819,-9.9768,-10.4413,-23.0568],[3.806,-4.1305,-9.3253,-18.8738,2.7748,-8.1583,-18.4695,-29.6678,-6.0971,-20.105,-20.6406,-33.5405],[6.6883,-3.0409,-3.0194,-14.3785,5.1562,-7.1802,-19.1605,-32.3246,0.1677,-20.6907,-15.1619,-35.1464],[14.4564,6.3728,-0.1005,-9.1258,15.518,5.4969,-3.1767,-14.1811,3.1329,-9.2338,-12.4093,-24.5595],[5.8616,-2.7981,-6.008,-16.8295,3.8772,-6.2498,-15.2343,-26.4368,-3.8508,-18.2179,-18.5381,-32.03],[5.4134,-6.9509,-0.5757,-15.2358,4.9782,-6.6008,-15.151,-28.9105,-0.7857,-21.8801,-12.837,-34.1831],[7.8845,5.2314,-0.9186,-3.926,8.5771,3.0838,-3.0052,-8.8584,0.2435,-8.2269,-9.2553,-17.7498]];
const PNL: number[][] = [[9318.63,6273.26,2861.42,-460.28,10152.24,3683.52,557.58,-7183.7,1899.13,-11683.17,-6959.05,-23515.0],[2371.71,85.24,-3798.97,-6502.22,25.52,-5124.43,-10247.66,-16471.31,-5520.0,-18069.49,-14321.92,-28676.18],[2294.52,451.58,-2110.12,-3865.13,451.34,-3250.05,-8714.2,-13009.27,-988.68,-11609.33,-8367.6,-20013.91],[9085.72,5607.09,1877.53,-2165.47,10790.96,4265.11,733.05,-7236.88,3203.44,-8384.01,-6240.63,-20877.97],[4346.25,1626.52,-1306.34,-4730.89,2734.43,-2583.43,-6778.54,-13341.63,-2407.34,-13267.8,-10449.04,-23190.52],[4371.72,2149.6,1202.94,-1219.3,3176.53,-699.16,-4511.03,-9151.93,1663.8,-7740.8,-4237.13,-14743.63],[6198.49,2462.66,-767.44,-5689.0,8469.01,2253.55,-2699.6,-11426.75,1926.66,-8211.86,-8122.49,-22214.13],[1357.22,-1619.7,-3519.46,-7822.57,1147.94,-3959.03,-8362.85,-15782.67,-2825.72,-12221.21,-11074.66,-23418.78],[1644.92,-816.56,-782.43,-4065.39,1434.32,-2341.75,-5811.36,-11420.25,50.4,-8155.52,-5306.66,-15682.08],[5877.96,2794.96,-44.03,-4312.76,7463.61,2998.19,-1694.8,-8605.82,1758.88,-6487.12,-8081.81,-20214.84],[1770.37,-933.18,-1928.96,-5958.68,1365.87,-2598.27,-5900.38,-12111.27,-1530.55,-9640.71,-8558.6,-19551.31],[1123.9,-1578.94,-126.09,-3650.42,1180.11,-1829.47,-3926.2,-8702.51,-203.81,-7513.64,-3886.93,-13300.19],[9591.48,6880.47,-1210.5,-5612.94,12003.56,4839.45,-4646.55,-15448.29,387.41,-15794.06,-16976.72,-39734.29]];
const EXPOSED: number[][] = [[138,138,138,138,149,150,149,150,155,156,155,156],[133,133,133,133,144,145,144,145,151,152,151,152],[117,117,117,117,120,121,120,121,120,121,120,121],[137,137,137,137,148,149,148,149,154,156,154,156],[132,132,132,132,143,144,143,144,150,152,150,152],[116,116,116,116,119,120,119,120,119,120,119,120],[137,137,137,137,148,149,148,149,154,156,154,156],[132,132,132,132,143,144,143,144,150,152,150,152],[116,116,116,116,119,120,119,120,119,120,119,120],[119,119,119,119,127,127,127,127,133,135,133,135],[98,98,98,98,98,98,98,98,98,98,98,98],[98,98,98,98,98,98,98,98,98,98,98,98],[190,191,190,191,193,193,193,193,193,193,193,193]];
const LOTDAYS: number[][] = [[4224,4507,4503,4806,4890,5441,5360,5981,5627,6795,6426,7814],[2927,3208,3112,3409,3346,3882,3674,4270,3736,4797,4269,5465],[2038,2226,2156,2358,2267,2639,2482,2884,2417,3118,2776,3530],[3444,3673,3685,3927,4015,4482,4431,4953,4643,5615,5358,6514],[2491,2718,2663,2899,2869,3329,3175,3680,3209,4126,3720,4736],[1721,1866,1834,1986,1925,2242,2126,2458,2053,2657,2398,3019],[2923,3129,3117,3333,3406,3819,3735,4196,3946,4802,4543,5570],[2143,2347,2260,2470,2462,2869,2678,3123,2746,3556,3146,4048],[1486,1611,1562,1691,1665,1933,1805,2081,1791,2311,2069,2599],[2440,2621,2617,2808,2847,3210,3136,3546,3313,4096,3810,4763],[1823,2003,1931,2117,2101,2461,2295,2692,2359,3099,2712,3543],[1259,1364,1326,1435,1421,1643,1545,1774,1547,2012,1793,2267],[7209,7720,7727,8295,8202,9111,8962,10013,9290,11077,10587,12787]];
const AVGLOT: number[][] = [[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0]];
const WIN: number[][] = [[50.4373,51.6035,48.105,49.2711,49.2711,50.1458,45.481,46.0641,44.898,43.1487,39.0671,36.4431],[46.6942,48.3471,45.4545,47.1074,40.4959,41.7355,38.4298,39.2562,38.0165,35.5372,34.7107,30.9917],[44.1176,46.4706,43.5294,45.8824,39.4118,41.1765,37.6471,38.8235,37.6471,34.1176,35.2941,30.0],[51.2635,51.6245,48.3755,48.7365,49.4585,50.5415,44.7653,45.4874,44.7653,43.3213,37.5451,35.0181],[48.2759,48.7685,46.798,47.2906,40.8867,42.3645,38.4236,39.4089,38.4236,36.4532,34.4828,31.0345],[47.5177,48.227,46.8085,47.5177,41.1348,43.2624,39.0071,40.4255,39.0071,36.1702,36.1702,31.2057],[50.211,50.211,47.2574,46.8354,49.3671,50.211,44.3038,44.3038,44.7257,43.4599,37.1308,34.1772],[46.5517,46.5517,45.4023,44.8276,40.8046,41.954,38.5057,38.5057,38.5057,36.7816,34.4828,30.4598],[46.281,46.281,46.281,45.4545,41.3223,42.9752,39.6694,39.6694,38.843,36.3636,36.3636,30.5785],[52.2613,51.7588,48.7437,47.7387,50.7538,51.7588,44.7236,44.7236,44.7236,43.2161,35.6784,32.1608],[47.973,47.2973,46.6216,45.2703,42.5676,43.9189,39.8649,39.8649,39.8649,37.8378,35.1351,30.4054],[46.0784,45.098,46.0784,44.1176,42.1569,44.1176,40.1961,40.1961,39.2157,36.2745,36.2745,29.4118],[48.2112,49.2334,45.6559,46.5077,48.552,49.5741,44.9744,45.4855,45.3152,44.6337,39.6934,37.6491]];
const CLOSED: number[][] = [[302,293,298,289,293,283,286,276,293,283,281,271],[217,211,217,211,212,205,209,202,212,205,206,199],[154,150,154,150,153,148,150,145,153,148,147,142],[248,242,246,240,244,238,240,234,244,238,236,230],[184,181,184,181,181,178,179,176,181,178,176,173],[129,128,129,128,129,128,127,126,129,128,124,123],[211,209,209,207,207,205,204,202,207,205,204,202],[157,156,157,156,154,153,153,152,154,153,153,152],[110,110,110,110,110,110,109,109,110,110,109,109],[181,179,180,178,175,173,173,171,175,173,173,171],[139,138,139,138,134,133,133,132,134,133,133,132],[97,97,97,97,95,95,94,94,95,95,94,94],[483,462,458,434,463,442,437,413,461,438,432,406]];
const OPENN: number[][] = [[41,50,45,54,50,60,57,67,50,60,62,72],[25,31,25,31,30,37,33,40,30,37,36,43],[16,20,16,20,17,22,20,25,17,22,23,28],[29,35,31,37,33,39,37,43,33,39,41,47],[19,22,19,22,22,25,24,27,22,25,27,30],[12,13,12,13,12,13,14,15,12,13,17,18],[26,28,28,30,30,32,33,35,30,32,33,35],[17,18,17,18,20,21,21,22,20,21,21,22],[11,11,11,11,11,11,12,12,11,11,12,12],[18,20,19,21,24,26,26,28,24,26,26,28],[9,10,9,10,14,15,15,16,14,15,15,16],[5,5,5,5,7,7,8,8,7,7,8,8],[104,125,129,153,124,145,150,174,126,149,155,181]];
const FROM: string[][] = [["2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30"],["2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04"],["2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04","2026-06-04"],["2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30"],["2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04"],["2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05"],["2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30"],["2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04"],["2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05","2026-06-05"],["2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30"],["2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17"],["2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17","2026-07-17"],["2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29"]];
const TO: string[][] = [["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"]];

function buyLabel(buy: Buy): string {
  return `>${buy.a},>${buy.p}%`;
}

function sellLabel(sell: Sell): string {
  return `${sell.h}d ${sell.t}% ${sell.d}dd`;
}

function money(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function lotMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function parseHex(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().replace("#", "");
  const hex = raw.length === 8 || raw.length === 4 ? raw.slice(0, raw.length === 8 ? 6 : 3) : raw;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (full.length !== 6 || Number.isNaN(parseInt(full, 16))) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function parseColor(value: string): { r: number; g: number; b: number } | null {
  const hex = parseHex(value);
  if (hex) return hex;
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function mix(a: string, b: string, t: number, fallback: string): string {
  const pa = parseColor(a);
  const pb = parseColor(b);
  if (!pa || !pb) return fallback;
  const clamp = Math.min(1, Math.max(0, t));
  const r = Math.round(pa.r + (pb.r - pa.r) * clamp);
  const g = Math.round(pa.g + (pb.g - pa.g) * clamp);
  const bl = Math.round(pa.b + (pb.b - pa.b) * clamp);
  return `rgb(${r}, ${g}, ${bl})`;
}

function heat(t: number, yellow: string, orange: string, red: string, fallback: string): string {
  const clamp = Math.min(1, Math.max(0, t));
  return clamp < 0.5
    ? mix(yellow, orange, clamp * 2, fallback)
    : mix(orange, red, (clamp - 0.5) * 2, fallback);
}

function channel(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function readable(bg: string, primary: string, editor: string): string {
  const b = parseColor(bg);
  const p = parseColor(primary);
  const e = parseColor(editor);
  if (!b || !p || !e) return primary;
  const score = (ink: { r: number; g: number; b: number }) => {
    const lighter = Math.max(luminance(b), luminance(ink));
    const darker = Math.min(luminance(b), luminance(ink));
    return (lighter + 0.05) / (darker + 0.05);
  };
  return score(p) >= score(e) ? primary : editor;
}

function span(values: number[]): { min: number; max: number } {
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function unit(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

const STAT_NAMES = ["min", "avg", "max"] as const;
type StatName = (typeof STAT_NAMES)[number];
type Stats = Record<StatName, number>;
const METRICS = ["pct", "pnl"] as const;
type Metric = (typeof METRICS)[number];

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function pack(values: number[]): Stats {
  return { min: Math.min(...values), avg: mean(values), max: Math.max(...values) };
}

function cornerOf(perRow: Stats[]): Record<StatName, Stats> {
  const out = {} as Record<StatName, Stats>;
  for (const rowStat of STAT_NAMES) {
    const row = {} as Stats;
    for (const colStat of STAT_NAMES) {
      row[colStat] = pack(perRow.map((item) => item[colStat]))[rowStat];
    }
    out[rowStat] = row;
  }
  return out;
}

function statLabel(name: StatName): string {
  if (name === "min") return "Min";
  if (name === "avg") return "Avg";
  return "Max";
}

function toggleItem<T extends string | number>(current: T[], value: T, all: readonly T[]): T[] {
  const has = current.includes(value);
  if (has && current.length === 1) return current;
  const next = has ? current.filter((item) => item !== value) : [...current, value];
  return all.filter((item) => next.includes(item));
}

function FilterGroup<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
}) {
  return (
    <Row gap={6} align="center" wrap>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      {options.map((option) => (
        <Pill
          key={String(option)}
          size="sm"
          active={selected.includes(option)}
          onClick={() => onChange(toggleItem(selected, option, options))}
        >
          {format(option)}
        </Pill>
      ))}
    </Row>
  );
}

function Scale({
  label,
  range,
  format,
  yellow,
  orange,
  red,
  fallback,
}: {
  label: string;
  range: { min: number; max: number };
  format: (n: number) => string;
  yellow: string;
  orange: string;
  red: string;
  fallback: string;
}) {
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <Row gap={8} align="center" wrap>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      <Text size="small" tone="tertiary">
        {format(range.min)}
      </Text>
      {steps.map((step) => (
        <div
          key={step}
          style={{
            width: 28,
            height: 14,
            background: heat(step, yellow, orange, red, fallback),
          }}
        />
      ))}
      <Text size="small" tone="tertiary">
        {format(range.max)}
      </Text>
    </Row>
  );
}

export default function FineGridCanvas() {
  const theme = useHostTheme();
  const [analysts, setAnalysts] = useCanvasState<number[]>("fine-analysts", ANALYSTS);
  const [upsides, setUpsides] = useCanvasState<number[]>("fine-upsides", UPSIDES);
  const [holds, setHolds] = useCanvasState<number[]>("fine-holds", HOLDS);
  const [targets, setTargets] = useCanvasState<number[]>("fine-targets", TARGETS);
  const [drops, setDrops] = useCanvasState<number[]>("fine-drops", DROPS);
  const [metrics, setMetrics] = useCanvasState<Metric[]>("fine-metrics", ["pct", "pnl"]);

  const view = useMemo(() => {
    const buys = BUYS.map((buy, row) => ({ buy, row })).filter(
      ({ buy }) => analysts.includes(buy.a) && upsides.includes(buy.p),
    );
    const sells = SELLS.map((sell, col) => ({ sell, col })).filter(
      ({ sell }) => holds.includes(sell.h) && targets.includes(sell.t) && drops.includes(sell.d),
    );
    const rowRoi = buys.map(({ row }) => pack(sells.map(({ col }) => ROI[row][col])));
    const rowPnl = buys.map(({ row }) => pack(sells.map(({ col }) => PNL[row][col])));
    const colRoi = sells.map(({ col }) => pack(buys.map(({ row }) => ROI[row][col])));
    const colPnl = sells.map(({ col }) => pack(buys.map(({ row }) => PNL[row][col])));
    return {
      buys,
      sells,
      rowRoi,
      rowPnl,
      colRoi,
      colPnl,
      cornerRoi: buys.length && sells.length ? cornerOf(rowRoi) : null,
      cornerPnl: buys.length && sells.length ? cornerOf(rowPnl) : null,
    };
  }, [analysts, upsides, holds, targets, drops]);

  const roiRange = span(ROI.flat());
  const pnlRange = span(PNL.flat());
  const showPct = metrics.includes("pct");
  const showPnl = metrics.includes("pnl");

  const cells = view.buys.flatMap(({ buy, row }) =>
    view.sells.map(({ sell, col }) => ({
      label: `${buyLabel(buy)} · ${sellLabel(sell)}`,
      sell: sellLabel(sell),
      buy: buyLabel(buy),
      roi: ROI[row][col],
      pnl: PNL[row][col],
      n: buy.n,
      from: FROM[row][col],
      to: TO[row][col],
      exposed: EXPOSED[row][col],
      lotDays: LOTDAYS[row][col],
      avgLot: AVGLOT[row][col],
      win: WIN[row][col],
      closed: CLOSED[row][col],
      open: OPENN[row][col],
    })),
  );
  const topScore = cells.reduce((best, cell) => (cell.roi > best.roi ? cell : best), cells[0]);
  const topCash = cells.reduce((best, cell) => (cell.pnl > best.pnl ? cell : best), cells[0]);
  const ranked = [...cells].sort((a, b) => b.roi - a.roi || b.pnl - a.pnl).slice(0, 12);

  const yellow = theme.category.yellow;
  const orange = theme.category.orange;
  const red = theme.category.red;
  const fallback = theme.fill.tertiary;
  const paint = (
    key: string,
    value: number,
    range: { min: number; max: number },
    text: string,
    title: string,
    edge = false,
  ) => {
    const background = heat(unit(value, range.min, range.max), yellow, orange, red, fallback);
    return (
      <td
        key={key}
        title={title}
        style={{
          background,
          color: readable(background, theme.text.primary, theme.bg.editor),
          textAlign: "right",
          padding: "6px 7px",
          fontSize: 12,
          lineHeight: "16px",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          borderLeft: edge ? `1px solid ${theme.stroke.secondary}` : undefined,
        }}
      >
        {text}
      </td>
    );
  };

  const labelCell = (text: string, sticky: boolean, strong: boolean) => (
    <td
      style={{
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        zIndex: sticky ? 1 : undefined,
        background: theme.bg.editor,
        padding: "6px 8px",
        whiteSpace: "nowrap",
        borderTop: strong ? `1px solid ${theme.stroke.secondary}` : undefined,
        borderLeft: strong && !sticky ? `1px solid ${theme.stroke.secondary}` : undefined,
      }}
    >
      <Text size="small" weight={strong ? "semibold" : "medium"}>
        {text}
      </Text>
    </td>
  );

  const countCell = (value: string, strong: boolean) => (
    <td
      style={{
        textAlign: "right",
        padding: "6px 8px",
        whiteSpace: "nowrap",
        borderTop: strong ? `1px solid ${theme.stroke.secondary}` : undefined,
      }}
    >
      <Text size="small" tone={strong ? "primary" : "secondary"} weight={strong ? "semibold" : "normal"}>
        {value}
      </Text>
    </td>
  );

  const head: CSSProperties = {
    textAlign: "center",
    padding: "4px 6px",
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 590,
    color: theme.text.secondary,
    whiteSpace: "nowrap",
    background: theme.bg.editor,
  };
  const both = showPct && showPnl;
  const pair = (key: string, roi: number, pnl: number, title: string, edge = false) => {
    const out = [];
    if (showPct) out.push(paint(`${key}-pct`, roi, roiRange, pct(roi), `${title} · return`, edge));
    if (showPnl) out.push(paint(`${key}-pnl`, pnl, pnlRange, money(pnl), `${title} · profit`, edge && !showPct));
    return out;
  };
  const filled = view.buys.length > 0 && view.sells.length > 0 && topScore && topCash && view.cornerRoi && view.cornerPnl;

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>{"Analysts >7\u201310 on the wide sell grid"}</H1>
        <Text size="small" tone="secondary">
          {SOURCE}
        </Text>
      </Stack>

      {filled ? (
        <Row gap={16} wrap>
          {showPct ? (
            <Stat value={pct(topScore.roi)} label={`Best return · ${topScore.label}`} tone="success" />
          ) : null}
          {showPnl ? <Stat value={money(topCash.pnl)} label={`Most cash · ${topCash.label}`} /> : null}
          <Stat value={`${topScore.from} → ${topScore.to}`} label="Best return · trade window" />
          <Stat value={String(topScore.exposed)} label="Best return · days exposed" />
          <Stat value={String(topScore.lotDays)} label="Best return · lot-days" />
          <Stat value={lotMoney(topScore.avgLot)} label="Best return · average lot" />
          <Stat value={String(cells.length)} label="Combinations shown" />
        </Row>
      ) : null}

      <Stack gap={8}>
        <FilterGroup
          label="Show"
          options={METRICS}
          selected={metrics}
          onChange={setMetrics}
          format={(value) => (value === "pct" ? "%" : "$")}
        />
        <FilterGroup
          label="Analysts"
          options={ANALYSTS}
          selected={analysts}
          onChange={setAnalysts}
          format={(value) => `>${value}`}
        />
        <FilterGroup
          label="Upside"
          options={UPSIDES}
          selected={upsides}
          onChange={setUpsides}
          format={(value) => `>${value}%`}
        />
        <FilterGroup
          label="Hold"
          options={HOLDS}
          selected={holds}
          onChange={setHolds}
          format={(value) => `${value}d`}
        />
        <FilterGroup
          label="Target"
          options={TARGETS}
          selected={targets}
          onChange={setTargets}
          format={(value) => `${value}%`}
        />
        <FilterGroup
          label="Drop"
          options={DROPS}
          selected={drops}
          onChange={setDrops}
          format={(value) => `${value}dd`}
        />
      </Stack>

      {filled ? (
        <Stack gap={8}>
          <H2>Buy × sell</H2>
          <Text size="small" tone="secondary">
            Yellow is the smaller number and red is the larger one, on a scale fixed to the full
            grid. The three columns are the min, average, and max of that buy across the sells in
            view. The three rows do the same for each sell across the buys in view. Symbols are
            unique tickers in that buy. Signals are the lots opened.
          </Text>
          {showPct ? (
            <Scale label="Return" range={roiRange} format={pct} yellow={yellow} orange={orange} red={red} fallback={fallback} />
          ) : null}
          {showPnl ? (
            <Scale label="Profit" range={pnlRange} format={money} yellow={yellow} orange={orange} red={red} fallback={fallback} />
          ) : null}
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th
                    rowSpan={both ? 2 : 1}
                    style={{ ...head, textAlign: "left", position: "sticky", left: 0, zIndex: 2 }}
                  >
                    Buy
                  </th>
                  <th rowSpan={both ? 2 : 1} style={{ ...head, textAlign: "right" }}>
                    Symbols
                  </th>
                  <th rowSpan={both ? 2 : 1} style={{ ...head, textAlign: "right" }}>
                    Signals
                  </th>
                  {view.sells.map(({ sell }) => (
                    <th key={sellLabel(sell)} colSpan={both ? 2 : 1} style={head}>
                      {sellLabel(sell)}
                    </th>
                  ))}
                  {STAT_NAMES.map((name, index) => (
                    <th
                      key={name}
                      colSpan={both ? 2 : 1}
                      style={{
                        ...head,
                        borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                      }}
                    >
                      {statLabel(name)}
                    </th>
                  ))}
                </tr>
                {both ? (
                  <tr>
                    {view.sells.flatMap(({ sell }) => {
                      const name = sellLabel(sell);
                      return [
                        <th key={`${name}-pct`} style={head}>
                          %
                        </th>,
                        <th key={`${name}-pnl`} style={head}>
                          $
                        </th>,
                      ];
                    })}
                    {STAT_NAMES.flatMap((name, index) => [
                      <th
                        key={`${name}-pct`}
                        style={{
                          ...head,
                          borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                        }}
                      >
                        %
                      </th>,
                      <th key={`${name}-pnl`} style={head}>
                        $
                      </th>,
                    ])}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {view.buys.map(({ buy, row }, index) => (
                  <tr key={buyLabel(buy)}>
                    {labelCell(buy.n < 30 ? `${buyLabel(buy)} · thin` : buyLabel(buy), true, false)}
                    {countCell(String(buy.sym), false)}
                    {countCell(String(buy.n), false)}
                    {view.sells.flatMap(({ sell, col }) => {
                      const name = `${buyLabel(buy)} · ${sellLabel(sell)}`;
                      const title = `${name} · ${FROM[row][col]} → ${TO[row][col]} · ${EXPOSED[row][col]} days exposed · ${LOTDAYS[row][col]} lot-days · avg lot ${lotMoney(AVGLOT[row][col])}`;
                      return pair(name, ROI[row][col], PNL[row][col], title);
                    })}
                    {STAT_NAMES.flatMap((name, statIndex) =>
                      pair(
                        `${buyLabel(buy)}-${name}`,
                        view.rowRoi[index][name],
                        view.rowPnl[index][name],
                        `${buyLabel(buy)} · ${statLabel(name)} across sells`,
                        statIndex === 0,
                      ),
                    )}
                  </tr>
                ))}
                {STAT_NAMES.map((rowStat, rowIndex) => (
                  <tr key={rowStat}>
                    {labelCell(statLabel(rowStat), true, rowIndex === 0)}
                    {countCell("—", rowIndex === 0)}
                    {countCell("—", rowIndex === 0)}
                    {view.sells.flatMap(({ sell }, index) => {
                      const name = sellLabel(sell);
                      return pair(
                        `${rowStat}-${name}`,
                        view.colRoi[index][rowStat],
                        view.colPnl[index][rowStat],
                        `${name} · ${statLabel(rowStat)} across buys`,
                      );
                    })}
                    {STAT_NAMES.flatMap((colStat, statIndex) =>
                      pair(
                        `${rowStat}-${colStat}`,
                        view.cornerRoi![rowStat][colStat],
                        view.cornerPnl![rowStat][colStat],
                        `${statLabel(rowStat)} of each buy's ${statLabel(colStat).toLowerCase()}`,
                        statIndex === 0,
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Stack>
      ) : (
        <Text size="small" tone="secondary">
          These pills leave out every buy in this grid.
        </Text>
      )}

      {filled ? (
        <Stack gap={8}>
          <H2>Lot exposure on the best returns</H2>
          <Text size="small" tone="secondary">
            Top 12 visible cells by return on invested. Days exposed are distinct calendar days
            with a lot open. Lot-days are the sum of each lot's calendar hold. A 3-day lot, a
            1-day lot, and another 3-day lot are 6 lot-days.
          </Text>
          <Table
            headers={["Sell", "Buy", "On invested", "Stock P&L", "Trade window", "Days exposed", "Lot-days", "Avg lot", "Win", "Lots"]}
            columnAlign={["left", "left", "right", "right", "left", "right", "right", "right", "right", "right"]}
            rows={ranked.map((cell) => [
              cell.sell,
              cell.buy,
              pct(cell.roi),
              money(cell.pnl),
              `${cell.from} → ${cell.to}`,
              String(cell.exposed),
              String(cell.lotDays),
              lotMoney(cell.avgLot),
              pct(cell.win),
              `${cell.closed}c/${cell.open}o`,
            ])}
            striped
            stickyHeader
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
