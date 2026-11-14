import {
  Grid,
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

const SOURCE = "yahoo_and_tipranks_1d_recency \u00b7 yahoo_and_tipranks_2d_recency \u00b7 yahoo_and_tipranks_3d_recency \u00b7 yahoo_and_tipranks_4d_recency \u00b7 yahoo_and_tipranks_5d_recency \u00b7 yahoo_and_tipranks_any_recency \u00b7 2026-01-02 \u2192 2026-10-26 \u00b7 205 trading days \u00b7 one book of $320,000. The lot count splits that cash, so fewer lots means more dollars in each lot. Upside filter includes >10%. Days utilized are calendar days with at least one lot open. Lots utilized is the average open lots divided by the lot count. Lot-days invested is the sum of each lot's calendar hold divided by the lot count times the calendar days in the test. Lot-days add each lot's calendar hold, so overlapping lots count again. Win rate counts a position once: lots with the same ticker, buy date, and buy price are one position. Hold is that position's calendar days, buy through sell. Several lots in one position count once. Buys stop on the last day of each range. Prices continue 6 calendar days, the p80 calendar hold of closed lots on 7.5dd 5pp \u00b7 ls \u00b7 at. A lot still open at the end of that grace stays open.";
const TITLE = "Half lots, a\u00d7t, recency union, next open";

const SIGNALS = ["yahoo_and_tipranks_any_recency"];
const ANALYSTS = [0, 2, 3, 4];
const UPSIDES = [10, 20, 30, 40, 50, 60];
const HOLDS = [256];
const TARGETS = [0];
const DROPS = [0];
const PROTECTS = [5, 10, 15];
const FILLERS: string[] = [];
const RULES: string[] = ["nb"];
const SIZES: string[] = ["a\u00d7t"];
const RANGES: string[] = ["10m_Jan-Oct"];
const SELL_MODE: string = "book";

function rangeLength(label: string): string {
  const cut = label.indexOf("m_");
  return cut > 0 ? label.slice(0, cut + 1) : "";
}

function rangeStart(label: string): string {
  const rest = label.slice(label.indexOf("m_") + 2);
  const dash = rest.indexOf("-");
  return dash < 0 ? rest : rest.slice(0, dash);
}

const LENGTHS: string[] = [];
const STARTS: string[] = [];
for (const label of RANGES) {
  const length = rangeLength(label);
  const start = rangeStart(label);
  if (length && !LENGTHS.includes(length)) LENGTHS.push(length);
  if (start && !STARTS.includes(start)) STARTS.push(start);
}

type Buy = { s: string; a: number; p: number; n: number; sym: number; w: string };
type Sell = { h: number; t: number; d: number; p: number; f: string; r: string; z: string; m: number; e: string };

const BUYS: Buy[] = [{"s":"yahoo_and_tipranks_any_recency","a":0,"p":10,"n":5991,"sym":498,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":0,"p":20,"n":3225,"sym":443,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":0,"p":30,"n":1496,"sym":333,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":0,"p":40,"n":747,"sym":214,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":0,"p":50,"n":370,"sym":128,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":0,"p":60,"n":205,"sym":78,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":10,"n":5991,"sym":498,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":20,"n":3225,"sym":443,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":30,"n":1496,"sym":333,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":40,"n":747,"sym":214,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":50,"n":370,"sym":128,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":60,"n":205,"sym":78,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":10,"n":3413,"sym":480,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":20,"n":1735,"sym":375,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":30,"n":798,"sym":234,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":40,"n":370,"sym":120,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":50,"n":173,"sym":69,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":60,"n":88,"sym":39,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":4,"p":10,"n":2386,"sym":455,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":4,"p":20,"n":1198,"sym":320,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":4,"p":30,"n":541,"sym":178,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":4,"p":40,"n":253,"sym":93,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":4,"p":50,"n":122,"sym":56,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":4,"p":60,"n":65,"sym":30,"w":"10m_Jan-Oct"}];
const SELLS: Sell[] = [{"h":256,"t":0,"d":0,"p":5,"f":"","r":"nb","z":"a\u00d7t","m":1250.0,"e":"next open"},{"h":256,"t":0,"d":0,"p":10,"f":"","r":"nb","z":"a\u00d7t","m":1250.0,"e":"next open"},{"h":256,"t":0,"d":0,"p":15,"f":"","r":"nb","z":"a\u00d7t","m":1250.0,"e":"next open"}];
const ENTRIES: string[] = [];
for (const sell of SELLS) {
  if (sell.e && !ENTRIES.includes(sell.e)) ENTRIES.push(sell.e);
}
const ROI: number[][] = [[15.3363,17.4239,21.309],[11.786,14.8163,20.3407],[20.8872,16.0345,20.3889],[42.2229,38.056,48.0384],[26.1737,23.8129,30.4902],[53.5586,47.99,46.1011],[15.3363,17.4239,21.309],[11.786,14.8163,20.3407],[20.8872,16.0345,20.3889],[42.2229,38.056,48.0384],[26.1737,23.8129,30.4902],[53.5586,47.99,46.1011],[10.0987,9.2868,10.5611],[10.045,7.3823,8.5824],[10.0823,7.1397,7.5592],[22.6506,18.0734,23.7304],[26.6543,24.6025,25.1992],[-17.8669,-20.3565,-19.6225],[7.505,6.7738,7.902],[7.2163,5.3712,4.6268],[28.9265,25.9384,26.419],[58.9408,55.6513,59.0143],[80.5679,77.3854,79.3852],[69.6162,61.6265,62.3916]];
const PNL: number[][] = [[44641.61,50627.97,61685.64],[34372.73,43055.89,58798.22],[58392.49,44840.93,56811.74],[111334.55,100787.98,127448.32],[64077.67,58469.31,75084.05],[111480.25,100664.89,98394.93],[44641.61,50627.97,61685.64],[34372.73,43055.89,58798.22],[58392.49,44840.93,56811.74],[111334.55,100787.98,127448.32],[64077.67,58469.31,75084.05],[111480.25,100664.89,98394.93],[28155.8,26005.89,29591.61],[26554.37,19594.56,22808.37],[22976.02,16323.75,17316.04],[41431.32,33288.16,44718.87],[41085.04,38426.33,40128.11],[-27727.5,-31737.49,-30790.54],[20853.49,18872.39,21920.32],[18833.32,14058.89,12108.79],[55383.6,50027.91,50784.09],[78969.82,75159.74,80241.49],[93787.86,91687.55,94865.29],[67073.46,60142.21,61862.75]];
const EXPOSED: number[][] = [[295,295,295],[295,295,295],[295,295,295],[295,295,295],[293,293,293],[292,292,293],[295,295,295],[295,295,295],[295,295,295],[295,295,295],[293,293,293],[292,292,293],[294,294,294],[293,293,293],[265,265,265],[259,259,259],[230,230,230],[199,199,199],[294,294,294],[288,291,291],[231,234,234],[200,203,205],[185,188,190],[143,147,149]];
const LOTUTIL: number[][] = [[90.9642,90.8022,90.463],[91.1376,90.8117,90.3335],[87.3628,87.3914,87.0751],[82.4009,82.763,82.9078],[76.5053,76.7302,76.955],[65.0457,65.5507,66.6978],[90.9642,90.8022,90.463],[91.1376,90.8117,90.3335],[87.3628,87.3914,87.0751],[82.4009,82.763,82.9078],[76.5053,76.7302,76.955],[65.0457,65.5507,66.6978],[87.1265,87.5095,87.561],[82.6105,82.9459,83.0488],[71.2138,71.4482,71.5854],[57.1608,57.5572,58.8891],[48.1688,48.8091,49.7637],[48.4966,48.7214,49.0358],[86.8312,87.0655,86.6883],[81.5568,81.795,81.7835],[59.8323,60.2725,60.0705],[41.8693,42.2046,42.4905],[36.3777,37.0255,37.3438],[30.1086,30.4973,30.9851]];
const LOTDAYS: number[][] = [[73052,73180,73165],[72938,72991,72892],[70783,71007,70970],[67674,67843,67809],[62405,62627,62648],[54380,54663,55302],[73052,73180,73165],[72938,72991,72892],[70783,71007,70970],[67674,67843,67809],[62405,62627,62648],[54380,54663,55302],[70889,71151,71285],[66808,67239,67254],[59023,59190,59188],[47934,48197,49079],[40433,40906,41703],[38411,38593,38750],[69119,69352,69196],[64854,65135,65101],[47989,48263,48146],[36182,36253,36352],[30997,31468,31653],[25011,25279,25535]];
const LOTDAYUTIL: number[][] = [[95.7582,95.926,95.9063],[95.6087,95.6782,95.5484],[92.7839,93.0775,93.029],[88.7086,88.9301,88.8855],[81.8019,82.0929,82.1204],[71.2825,71.6535,72.4911],[95.7582,95.926,95.9063],[95.6087,95.6782,95.5484],[92.7839,93.0775,93.029],[88.7086,88.9301,88.8855],[81.8019,82.0929,82.1204],[71.2825,71.6535,72.4911],[92.9229,93.2663,93.442],[87.5734,88.1384,88.158],[77.3687,77.5876,77.5849],[62.8329,63.1777,64.3338],[53.0005,53.6205,54.6652],[50.35,50.5886,50.7944],[90.6027,90.9081,90.7036],[85.0121,85.3804,85.3358],[62.905,63.2642,63.1108],[47.4282,47.5212,47.651],[40.6316,41.249,41.4915],[32.785,33.1363,33.4718]];
const AVGLOT: number[][] = [[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0],[1250.0,1250.0,1250.0]];
const WIN: number[][] = [[59.8182,58.9091,58.8968],[59.847,59.887,59.3807],[60.2299,59.6372,59.292],[60.5978,60.1078,60.0],[60.2317,59.2157,59.4488],[60.7955,59.6591,60.0],[59.8182,58.9091,58.8968],[59.847,59.887,59.3807],[60.2299,59.6372,59.292],[60.5978,60.1078,60.0],[60.2317,59.2157,59.4488],[60.7955,59.6591,60.0],[57.6419,57.6754,57.1744],[56.5934,56.4865,55.7065],[58.8028,57.9661,57.8595],[57.8199,58.6047,57.8704],[57.0423,57.4468,57.4468],[58.9744,58.9744,58.4416],[58.309,58.5507,58.4527],[58.9091,59.1398,58.8448],[60.9302,60.4545,58.7444],[60.0,59.8837,58.9595],[56.0748,56.0748,56.0748],[59.322,59.322,59.322]];
const CLOSED: number[][] = [[3959,4032,4185],[3728,3893,4096],[4433,4543,4642],[4954,4946,4821],[4274,4254,4220],[4906,4792,4634],[3959,4032,4185],[3728,3893,4096],[4433,4543,4642],[4954,4946,4821],[4274,4254,4220],[4906,4792,4634],[4492,4322,4370],[4218,4145,4090],[4665,4604,4580],[4708,4725,4638],[3681,3625,3559],[1715,1715,1683],[3162,3091,3209],[2968,2900,2858],[3465,3377,3413],[4469,4476,4463],[3754,3700,3670],[2393,2393,2393]];
const OPENN: number[][] = [[244,212,213],[246,212,211],[250,232,232],[255,255,242],[256,255,242],[256,255,255],[244,212,213],[246,212,211],[250,232,232],[255,255,242],[256,255,242],[256,255,255],[245,209,210],[246,214,213],[249,225,225],[255,255,243],[255,256,251],[256,256,256],[249,225,222],[249,223,223],[242,220,216],[255,255,239],[255,255,243],[256,256,256]];
const SYMBOLS: number[][] = [[238,235,237],[220,219,224],[182,185,184],[149,150,151],[106,106,106],[70,70,70],[238,235,237],[220,219,224],[182,185,184],[149,150,151],[106,106,106],[70,70,70],[218,217,211],[163,165,164],[122,125,125],[85,86,86],[65,64,64],[35,35,35],[172,172,173],[134,136,135],[95,97,97],[72,72,72],[52,52,52],[29,29,29]];
const POSITIONS: number[][] = [[550,550,562],[523,531,549],[435,441,452],[368,371,370],[259,255,254],[176,176,175],[550,550,562],[523,531,549],[435,441,452],[368,371,370],[259,255,254],[176,176,175],[458,456,453],[364,370,368],[284,295,299],[211,215,216],[142,141,141],[78,78,77],[343,345,349],[275,279,277],[215,220,223],[170,172,173],[107,107,107],[59,59,59]];
const STAY: number[][][] = [[[1.0,16.1036,291.0,3.0,6.0,11.0],[1.0,16.7745,291.0,3.0,6.0,13.0],[1.0,16.9804,291.0,3.0,6.0,13.0]],[[1.0,15.5468,291.0,3.0,6.0,11.0],[1.0,15.9962,291.0,3.0,6.0,12.5],[1.0,16.5792,291.0,3.0,6.0,13.0]],[[1.0,13.8874,291.0,3.0,5.0,11.0],[1.0,14.1927,291.0,3.0,5.0,11.0],[1.0,14.3208,291.0,3.0,6.0,12.0]],[[1.0,12.0272,186.0,3.0,6.0,11.0],[1.0,12.1644,186.0,3.0,6.0,11.0],[1.0,12.7135,186.0,3.0,6.0,12.0]],[[1.0,12.6602,186.0,3.0,6.0,11.0],[1.0,12.9569,186.0,3.0,6.0,12.0],[1.0,13.185,186.0,3.0,6.0,12.0]],[[1.0,11.8068,186.0,3.0,5.0,8.25],[1.0,11.9545,186.0,3.0,5.0,10.25],[1.0,12.0286,186.0,3.0,5.0,10.0]],[[1.0,16.1036,291.0,3.0,6.0,11.0],[1.0,16.7745,291.0,3.0,6.0,13.0],[1.0,16.9804,291.0,3.0,6.0,13.0]],[[1.0,15.5468,291.0,3.0,6.0,11.0],[1.0,15.9962,291.0,3.0,6.0,12.5],[1.0,16.5792,291.0,3.0,6.0,13.0]],[[1.0,13.8874,291.0,3.0,5.0,11.0],[1.0,14.1927,291.0,3.0,5.0,11.0],[1.0,14.3208,291.0,3.0,6.0,12.0]],[[1.0,12.0272,186.0,3.0,6.0,11.0],[1.0,12.1644,186.0,3.0,6.0,11.0],[1.0,12.7135,186.0,3.0,6.0,12.0]],[[1.0,12.6602,186.0,3.0,6.0,11.0],[1.0,12.9569,186.0,3.0,6.0,12.0],[1.0,13.185,186.0,3.0,6.0,12.0]],[[1.0,11.8068,186.0,3.0,5.0,8.25],[1.0,11.9545,186.0,3.0,5.0,10.25],[1.0,12.0286,186.0,3.0,5.0,10.0]],[[1.0,14.1463,257.0,3.0,6.0,12.0],[1.0,14.4846,257.0,3.0,6.0,13.0],[1.0,14.7086,257.0,3.0,6.0,13.0]],[[1.0,13.8901,183.0,3.0,5.0,12.0],[1.0,13.9649,183.0,3.0,6.0,12.0],[1.0,14.3315,183.0,3.0,6.0,13.0]],[[1.0,11.0528,183.0,3.0,5.0,10.25],[1.0,11.2644,183.0,3.0,5.0,11.0],[1.0,11.5084,183.0,3.0,6.0,11.5]],[[1.0,10.0142,183.0,3.0,5.0,9.0],[1.0,10.1535,183.0,3.0,5.0,9.0],[1.0,10.4722,183.0,3.0,6.0,10.25]],[[1.0,9.6901,183.0,3.0,5.0,8.0],[1.0,9.9362,183.0,3.0,5.0,8.0],[1.0,10.156,183.0,3.0,5.0,8.0]],[[1.0,10.9872,183.0,3.0,4.0,8.0],[1.0,11.0641,183.0,3.0,4.0,8.0],[1.0,11.2857,183.0,3.0,5.0,9.0]],[[1.0,13.9359,257.0,3.0,5.0,10.5],[1.0,14.3217,257.0,3.0,5.0,12.0],[1.0,14.4756,257.0,3.0,6.0,12.0]],[[1.0,12.1964,180.0,3.0,5.0,11.0],[1.0,12.3584,180.0,3.0,5.0,11.5],[1.0,12.7256,180.0,3.0,6.0,12.0]],[[1.0,10.1116,172.0,3.0,5.0,10.0],[1.0,10.2455,172.0,3.0,5.0,10.0],[1.0,10.426,172.0,3.0,5.0,11.0]],[[1.0,7.6294,78.0,3.0,5.0,8.0],[1.0,7.7442,78.0,3.0,5.0,8.0],[1.0,8.0,78.0,3.0,5.0,8.0]],[[1.0,7.5514,78.0,2.5,4.0,7.0],[1.0,7.6636,78.0,2.5,4.0,7.5],[1.0,7.8411,78.0,3.0,5.0,8.0]],[[1.0,7.8136,78.0,2.0,4.0,7.5],[1.0,7.9153,78.0,2.0,4.0,7.5],[1.0,7.9492,78.0,2.0,4.0,7.5]]];
const FROM: string[][] = [["2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05"],["2026-01-06","2026-01-06","2026-01-06"],["2026-01-06","2026-01-06","2026-01-06"],["2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05"],["2026-01-06","2026-01-06","2026-01-06"],["2026-01-06","2026-01-06","2026-01-06"],["2026-01-06","2026-01-06","2026-01-06"],["2026-01-07","2026-01-07","2026-01-07"],["2026-01-28","2026-01-28","2026-01-28"],["2026-02-09","2026-02-09","2026-02-09"],["2026-02-10","2026-02-10","2026-02-10"],["2026-02-10","2026-02-10","2026-02-10"],["2026-01-06","2026-01-06","2026-01-06"],["2026-01-07","2026-01-07","2026-01-07"],["2026-02-09","2026-02-09","2026-02-09"],["2026-02-09","2026-02-09","2026-02-09"],["2026-02-17","2026-02-17","2026-02-17"],["2026-02-25","2026-02-25","2026-02-25"]];
const TO: string[][] = [["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26"]];

const LOT_MONEY: Record<number, number> = {};
for (const sell of SELLS) if (sell.m) LOT_MONEY[sell.h] = sell.m;

function lotSplit(slots: number): string {
  const dollars = LOT_MONEY[slots];
  if (!dollars) return `${slots} lots`;
  return `${slots} × $${Math.round(dollars).toLocaleString("en-US")}`;
}

function lotSizeLabel(value: string): string {
  if (value === "str") return "strength";
  if (value === "1") return "1 lot";
  return value;
}

function buyLabel(buy: Buy): string {
  const cut = `>${buy.a},>${buy.p}%`;
  const book = buy.s ? `${buy.s} · ${cut}` : cut;
  return buy.w ? `${buy.w} · ${book}` : book;
}

function sellLabel(sell: Sell): string {
  if (SELL_MODE === "book") {
    if (!sell.d) {
      return [sell.p ? `${sell.p}pp` : "", lotSplit(sell.h), lotSizeLabel(sell.z)].filter(Boolean).join(" · ");
    }
    const base = `${sell.d}dd ${sell.p}pp · ${lotSplit(sell.h)}`;
    const fillerName = sell.f === "none" ? "no SPY" : sell.f;
    const ruleName = sell.r === "ls" ? "ls" : sell.r === "dls" ? "dls" : sell.r;
    const lotName = lotSizeLabel(sell.z);
    const entryName = sell.e || "";
    return [base, fillerName, ruleName, lotName, entryName].filter(Boolean).join(" · ");
  }
  if (SELL_MODE === "slots") return `${sell.h} lots`;
  if (SELL_MODE === "protect") return `${sell.d}dd ${sell.p}pp`;
  return `${sell.h}d ${sell.t}% ${sell.d}dd`;
}

function money(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function share(n: number): string {
  return `${n.toFixed(1)}%`;
}

function lotMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function days(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
const SHOW_MODES = ["pct", "pnl", "both"] as const;
type ShowMode = (typeof SHOW_MODES)[number];
type Metric = "pct" | "pnl";
const SYMBOL_FLOORS = [0, 2, 4, 7, 8, 9, 10, 12, 14, 16, 18, 20, 40, 80, 160, 320] as const;

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

function emptyBuckets(options: readonly (string | number)[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const option of options) out[String(option)] = [];
  return out;
}

type SliceStats = { roi: Stats | null; pnl: Stats | null; sym: Stats | null; win: Stats | null };

function packSlice(
  roiGroups: Record<string, number[]>,
  pnlGroups: Record<string, number[]>,
  symGroups: Record<string, number[]>,
  winGroups: Record<string, number[]>,
): Record<string, SliceStats> {
  const out: Record<string, SliceStats> = {};
  for (const key of Object.keys(roiGroups)) {
    const roi = roiGroups[key];
    const pnl = pnlGroups[key] ?? [];
    const sym = symGroups[key];
    const win = winGroups[key];
    out[key] = {
      roi: roi.length ? pack(roi) : null,
      pnl: pnl.length ? pack(pnl) : null,
      sym: sym.length ? pack(sym) : null,
      win: win.length ? pack(win) : null,
    };
  }
  return out;
}

function countText(value: number | undefined): string {
  return value === undefined ? "—" : String(Math.round(value));
}

function winText(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function FilterColumn<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
  stats,
  moneyMode = false,
  exclusive = false,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
  stats: Record<string, SliceStats>;
  moneyMode?: boolean;
  exclusive?: boolean;
}) {
  const figure = {
    textAlign: "right" as const,
    fontVariantNumeric: "tabular-nums" as const,
  };
  const lead = (statsFor: Stats | null | undefined, name: StatName) => {
    if (!statsFor) return "—";
    return moneyMode ? money(statsFor[name]) : pct(statsFor[name]);
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: moneyMode
          ? "minmax(0, 1fr) 6.6em 6.6em 6.6em 3.2em 3.2em 3.2em 4.2em 4.2em 4.2em"
          : "minmax(0, 1fr) 4.5em 4.5em 4.5em 3.2em 3.2em 3.2em 4.2em 4.2em 4.2em",
        columnGap: 6,
        rowGap: 2,
        alignItems: "center",
      }}
    >
      <span />
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "2 / span 3", textAlign: "center" }}>
        {moneyMode ? "P&L" : "Return"}
      </Text>
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "5 / span 3", textAlign: "center" }}>
        Symbols
      </Text>
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "8 / span 3", textAlign: "center" }}>
        Win rate
      </Text>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      {["Min", "Avg", "Max", "Min", "Avg", "Max", "Min", "Avg", "Max"].map((name, index) => (
        <Text key={`${name}-${index}`} as="span" size="small" tone="tertiary" style={figure}>
          {name}
        </Text>
      ))}
      {options.map((option) => {
        const stat = stats[String(option)];
        const active = selected.includes(option);
        const tone = active ? "primary" : "tertiary";
        return (
          <div key={String(option)} style={{ display: "contents" }}>
            <div style={{ minWidth: 0, justifySelf: "start" }}>
              <Pill
                size="sm"
                active={active}
                onClick={() =>
                  onChange(exclusive ? [option] : toggleItem(selected, option, options))
                }
              >
                {format(option)}
              </Pill>
            </div>
            <Text as="span" size="small" tone={tone} style={figure}>
              {lead(moneyMode ? stat?.pnl : stat?.roi, "min")}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {lead(moneyMode ? stat?.pnl : stat?.roi, "avg")}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {lead(moneyMode ? stat?.pnl : stat?.roi, "max")}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.min)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.avg)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.max)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.min)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.avg)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.max)}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

function FilterGroup<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
  exclusive = false,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
  exclusive?: boolean;
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
          onClick={() =>
            onChange(exclusive ? [option] : toggleItem(selected, option, options))
          }
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
  const [books, setBooks] = useCanvasState<string[]>("next-signals", SIGNALS);
  const [analysts, setAnalysts] = useCanvasState<number[]>("next-analysts", ANALYSTS);
  const [upsideFloor, setUpsideFloor] = useCanvasState<number>("next-upside-floor", UPSIDES[0]);
  const [holds, setHolds] = useCanvasState<number[]>("next-holds", HOLDS);
  const [targets, setTargets] = useCanvasState<number[]>("next-targets", TARGETS);
  const [drops, setDrops] = useCanvasState<number[]>("next-drops", DROPS);
  const [protects, setProtects] = useCanvasState<number[]>("next-protects", PROTECTS);
  const [showMode, setShowMode] = useCanvasState<ShowMode>("next-show-mode", "both");
  const [sortKey, setSortKey] = useCanvasState<string>("next-sort-key", "");
  const [sortDir, setSortDir] = useCanvasState<"asc" | "desc">("next-sort-dir", "desc");
  const [symbolFloor, setSymbolFloor] = useCanvasState<number>("next-symbol-floor", 0);
  const [filler, setFiller] = useCanvasState<string>("next-filler", FILLERS[0] ?? "");
  const [rules, setRules] = useCanvasState<string[]>("grace-rules", RULES);
  const [sizes, setSizes] = useCanvasState<string[]>("next-sizes", SIZES);
  const [entries, setEntries] = useCanvasState<string[]>("fills-entries", ENTRIES);
  const [lengths, setLengths] = useCanvasState<string[]>("grace-lengths", LENGTHS);
  const [starts, setStarts] = useCanvasState<string[]>("grace-starts", STARTS);

  const view = useMemo(() => {
    const buys = BUYS.map((buy, row) => ({ buy, row })).filter(
      ({ buy }) =>
        books.includes(buy.s) &&
        analysts.includes(buy.a) &&
        buy.p >= upsideFloor &&
        buy.sym > symbolFloor &&
        (RANGES.length === 0 ||
          (lengths.includes(rangeLength(buy.w)) && starts.includes(rangeStart(buy.w)))),
    );
    const bookMode = SELL_MODE === "book";
    const protectMode = SELL_MODE === "protect";
    const slotsMode = SELL_MODE === "slots";
    const sells = SELLS.map((sell, col) => ({ sell, col })).filter(({ sell }) =>
      bookMode
        ? holds.includes(sell.h) &&
          protects.includes(sell.p) &&
          drops.includes(sell.d) &&
          (FILLERS.length === 0 || sell.f === filler) &&
          (RULES.length === 0 || rules.includes(sell.r)) &&
          (SIZES.length === 0 || sizes.includes(sell.z)) &&
          (ENTRIES.length === 0 || entries.includes(sell.e))
        : slotsMode
          ? true
          : protectMode
            ? protects.includes(sell.p) && drops.includes(sell.d)
            : holds.includes(sell.h) && targets.includes(sell.t) && drops.includes(sell.d),
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
  }, [books, analysts, upsideFloor, holds, targets, drops, protects, symbolFloor, filler, rules, sizes, entries, lengths, starts]);

  const filterStats = useMemo(() => {
    const signalRoi = emptyBuckets(SIGNALS);
    const signalPnl = emptyBuckets(SIGNALS);
    const signalSym = emptyBuckets(SIGNALS);
    const signalWin = emptyBuckets(SIGNALS);
    const analystRoi = emptyBuckets(ANALYSTS);
    const analystPnl = emptyBuckets(ANALYSTS);
    const analystSym = emptyBuckets(ANALYSTS);
    const analystWin = emptyBuckets(ANALYSTS);
    const upsideRoi = emptyBuckets(UPSIDES);
    const upsidePnl = emptyBuckets(UPSIDES);
    const upsideSym = emptyBuckets(UPSIDES);
    const upsideWin = emptyBuckets(UPSIDES);
    const symbolRoi = emptyBuckets(SYMBOL_FLOORS);
    const symbolPnl = emptyBuckets(SYMBOL_FLOORS);
    const symbolSym = emptyBuckets(SYMBOL_FLOORS);
    const symbolWin = emptyBuckets(SYMBOL_FLOORS);
    const holdRoi = emptyBuckets(HOLDS);
    const holdPnl = emptyBuckets(HOLDS);
    const holdSym = emptyBuckets(HOLDS);
    const holdWin = emptyBuckets(HOLDS);
    const targetRoi = emptyBuckets(TARGETS);
    const targetPnl = emptyBuckets(TARGETS);
    const targetSym = emptyBuckets(TARGETS);
    const targetWin = emptyBuckets(TARGETS);
    const dropRoi = emptyBuckets(DROPS);
    const dropPnl = emptyBuckets(DROPS);
    const dropSym = emptyBuckets(DROPS);
    const dropWin = emptyBuckets(DROPS);
    const protectRoi = emptyBuckets(PROTECTS);
    const protectPnl = emptyBuckets(PROTECTS);
    const protectSym = emptyBuckets(PROTECTS);
    const protectWin = emptyBuckets(PROTECTS);
    const fillerRoi = emptyBuckets(FILLERS);
    const fillerPnl = emptyBuckets(FILLERS);
    const fillerSym = emptyBuckets(FILLERS);
    const fillerWin = emptyBuckets(FILLERS);
    const ruleRoi = emptyBuckets(RULES);
    const rulePnl = emptyBuckets(RULES);
    const ruleSym = emptyBuckets(RULES);
    const ruleWin = emptyBuckets(RULES);
    const sizeRoi = emptyBuckets(SIZES);
    const sizePnl = emptyBuckets(SIZES);
    const sizeSym = emptyBuckets(SIZES);
    const sizeWin = emptyBuckets(SIZES);
    const entryRoi = emptyBuckets(ENTRIES);
    const entryPnl = emptyBuckets(ENTRIES);
    const entrySym = emptyBuckets(ENTRIES);
    const entryWin = emptyBuckets(ENTRIES);
    const lengthRoi = emptyBuckets(LENGTHS);
    const lengthPnl = emptyBuckets(LENGTHS);
    const lengthSym = emptyBuckets(LENGTHS);
    const lengthWin = emptyBuckets(LENGTHS);
    const startRoi = emptyBuckets(STARTS);
    const startPnl = emptyBuckets(STARTS);
    const startSym = emptyBuckets(STARTS);
    const startWin = emptyBuckets(STARTS);
    const bookMode = SELL_MODE === "book";
    const protectMode = SELL_MODE === "protect";
    const slotsMode = SELL_MODE === "slots";
    const push = (
      roiBucket: Record<string, number[]>,
      pnlBucket: Record<string, number[]>,
      symBucket: Record<string, number[]>,
      winBucket: Record<string, number[]>,
      key: string,
      roi: number,
      pnl: number,
      sym: number,
      win: number,
    ) => {
      roiBucket[key]?.push(roi);
      pnlBucket[key]?.push(pnl);
      symBucket[key]?.push(sym);
      if (Number.isFinite(win)) winBucket[key]?.push(win);
    };
    BUYS.forEach((buy, row) => {
      const signalOk = books.includes(buy.s);
      const analystOk = analysts.includes(buy.a);
      const upsideOk = buy.p >= upsideFloor;
      const symbolOk = buy.sym > symbolFloor;
      const lengthName = rangeLength(buy.w);
      const startName = rangeStart(buy.w);
      const lengthOk = RANGES.length === 0 || lengths.includes(lengthName);
      const startOk = RANGES.length === 0 || starts.includes(startName);
      const rangeOk = lengthOk && startOk;
      SELLS.forEach((sell, col) => {
        const roi = ROI[row][col];
        const pnl = PNL[row][col];
        const win = WIN[row][col];
        if (!Number.isFinite(roi) || !Number.isFinite(pnl)) return;
        const fillerOn = FILLERS.length === 0 || sell.f === filler;
        const ruleOn = RULES.length === 0 || rules.includes(sell.r);
        const sizeOn = SIZES.length === 0 || sizes.includes(sell.z);
        const entryOn = ENTRIES.length === 0 || entries.includes(sell.e);
        const holdOk = bookMode
          ? holds.includes(sell.h)
          : slotsMode || protectMode || holds.includes(sell.h);
        const targetOk = bookMode
          ? protects.includes(sell.p)
          : slotsMode || (protectMode ? protects.includes(sell.p) : targets.includes(sell.t));
        const dropOk = bookMode ? drops.includes(sell.d) : slotsMode || drops.includes(sell.d);
        const sellsOk = holdOk && targetOk && dropOk;
        const buysOk = signalOk && analystOk && upsideOk && symbolOk && rangeOk;
        if (FILLERS.length && buysOk && sellsOk && ruleOn && sizeOn && entryOn) push(fillerRoi, fillerPnl, fillerSym, fillerWin, sell.f, roi, pnl, buy.sym, win);
        if (RULES.length && buysOk && sellsOk && fillerOn && sizeOn && entryOn) push(ruleRoi, rulePnl, ruleSym, ruleWin, sell.r, roi, pnl, buy.sym, win);
        if (SIZES.length && buysOk && sellsOk && fillerOn && ruleOn && entryOn) push(sizeRoi, sizePnl, sizeSym, sizeWin, sell.z, roi, pnl, buy.sym, win);
        if (ENTRIES.length && buysOk && sellsOk && fillerOn && ruleOn && sizeOn) push(entryRoi, entryPnl, entrySym, entryWin, sell.e, roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && entryOn && analystOk && upsideOk && symbolOk && sellsOk && rangeOk) push(signalRoi, signalPnl, signalSym, signalWin, buy.s, roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && entryOn && signalOk && upsideOk && symbolOk && sellsOk && rangeOk) push(analystRoi, analystPnl, analystSym, analystWin, String(buy.a), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && entryOn && signalOk && analystOk && symbolOk && sellsOk && rangeOk) {
          for (const floor of UPSIDES) {
            if (buy.p >= floor) push(upsideRoi, upsidePnl, upsideSym, upsideWin, String(floor), roi, pnl, buy.sym, win);
          }
        }
        if (LENGTHS.length && startOk && fillerOn && ruleOn && sizeOn && entryOn && signalOk && analystOk && upsideOk && symbolOk && sellsOk) push(lengthRoi, lengthPnl, lengthSym, lengthWin, lengthName, roi, pnl, buy.sym, win);
        if (STARTS.length && lengthOk && fillerOn && ruleOn && sizeOn && entryOn && signalOk && analystOk && upsideOk && symbolOk && sellsOk) push(startRoi, startPnl, startSym, startWin, startName, roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && entryOn && signalOk && analystOk && upsideOk && sellsOk && rangeOk) {
          for (const floor of SYMBOL_FLOORS) {
            if (buy.sym > floor) push(symbolRoi, symbolPnl, symbolSym, symbolWin, String(floor), roi, pnl, buy.sym, win);
          }
        }
        if (fillerOn && ruleOn && sizeOn && entryOn && !protectMode && buysOk && targetOk && dropOk) push(holdRoi, holdPnl, holdSym, holdWin, String(sell.h), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && entryOn && !protectMode && buysOk && holdOk && dropOk) push(targetRoi, targetPnl, targetSym, targetWin, String(sell.t), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && entryOn && ((protectMode && buysOk && dropOk) || (bookMode && buysOk && holds.includes(sell.h) && drops.includes(sell.d)))) push(protectRoi, protectPnl, protectSym, protectWin, String(sell.p), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && entryOn && buysOk && holdOk && targetOk) push(dropRoi, dropPnl, dropSym, dropWin, String(sell.d), roi, pnl, buy.sym, win);
      });
    });
    return {
      signal: packSlice(signalRoi, signalPnl, signalSym, signalWin),
      analyst: packSlice(analystRoi, analystPnl, analystSym, analystWin),
      upside: packSlice(upsideRoi, upsidePnl, upsideSym, upsideWin),
      symbol: packSlice(symbolRoi, symbolPnl, symbolSym, symbolWin),
      hold: packSlice(holdRoi, holdPnl, holdSym, holdWin),
      target: packSlice(targetRoi, targetPnl, targetSym, targetWin),
      drop: packSlice(dropRoi, dropPnl, dropSym, dropWin),
      protect: packSlice(protectRoi, protectPnl, protectSym, protectWin),
      filler: packSlice(fillerRoi, fillerPnl, fillerSym, fillerWin),
      rule: packSlice(ruleRoi, rulePnl, ruleSym, ruleWin),
      size: packSlice(sizeRoi, sizePnl, sizeSym, sizeWin),
      entry: packSlice(entryRoi, entryPnl, entrySym, entryWin),
      length: packSlice(lengthRoi, lengthPnl, lengthSym, lengthWin),
      start: packSlice(startRoi, startPnl, startSym, startWin),
    };
  }, [books, analysts, upsideFloor, holds, targets, drops, protects, symbolFloor, filler, rules, sizes, entries, lengths, starts]);

  const roiRange = span(ROI.flat());
  const pnlRange = span(PNL.flat());
  const showPct = showMode !== "pnl";
  const showPnl = showMode !== "pct";

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
      lotsUtil: LOTUTIL[row][col],
      lotDays: LOTDAYS[row][col],
      lotDayUtil: LOTDAYUTIL[row][col],
      avgLot: AVGLOT[row][col],
      win: WIN[row][col],
      closed: CLOSED[row][col],
      open: OPENN[row][col],
      symbols: SYMBOLS[row][col],
      positions: POSITIONS[row][col],
      stay: STAY[row][col],
    })),
  );
  const topScore = cells.reduce((best, cell) => (cell.roi > best.roi ? cell : best), cells[0]);
  const topCash = cells.reduce((best, cell) => (cell.pnl > best.pnl ? cell : best), cells[0]);
  const byMoney = showMode === "pnl";
  const ranked = [...cells]
    .sort((a, b) => (byMoney ? b.pnl - a.pnl || b.roi - a.roi : b.roi - a.roi || b.pnl - a.pnl))
    .slice(0, 30);

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
  const activeMetric: Metric = showPct ? "pct" : "pnl";
  const chooseSort = (key: string, numeric: boolean) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(numeric ? "desc" : "asc");
    }
  };
  const sortMark = (key: string) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const sortStyle = (extra?: CSSProperties): CSSProperties => ({
    ...head,
    cursor: "pointer",
    userSelect: "none",
    ...extra,
  });
  const orderedBuys = [...view.buys.map((item, index) => ({ ...item, index }))].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;
    const read = (item: { buy: Buy; row: number; index: number }): number | string => {
      if (sortKey === "buy") return buyLabel(item.buy);
      if (sortKey === "sym") return item.buy.sym;
      if (sortKey === "n") return item.buy.n;
      const [kind, id, metric] = sortKey.split(":");
      if (kind === "stat") {
        const stats = metric === "pnl" ? view.rowPnl[item.index] : view.rowRoi[item.index];
        return stats[id as StatName];
      }
      const col = Number(id);
      return metric === "pnl" ? PNL[item.row][col] : ROI[item.row][col];
    };
    const av = read(a);
    const bv = read(b);
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
    const left = Number.isFinite(av as number) ? (av as number) : dir === 1 ? Infinity : -Infinity;
    const right = Number.isFinite(bv as number) ? (bv as number) : dir === 1 ? Infinity : -Infinity;
    return (left - right) * dir;
  });
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
        <H1>{TITLE}</H1>
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
          <Stat value={pct(topScore.lotsUtil)} label="Best return · lots utilized" />
          <Stat value={String(topScore.exposed)} label="Best return · days utilized" />
          <Stat value={String(topScore.lotDays)} label="Best return · lot-days" />
          {SELL_MODE === "book" ? (
            <Stat value={share(topScore.lotDayUtil)} label="Best return · lot-days invested" />
          ) : null}
          <Stat value={lotMoney(topScore.avgLot)} label="Best return · average lot" />
          <Stat value={days(topScore.stay?.[0] ?? 0)} label="Best return · hold min, days" />
          <Stat value={days(topScore.stay?.[1] ?? 0)} label="Best return · hold avg, days" />
          <Stat value={days(topScore.stay?.[2] ?? 0)} label="Best return · hold max, days" />
          <Stat value={days(topScore.stay?.[3] ?? 0)} label="Best return · hold p25, days" />
          <Stat value={days(topScore.stay?.[4] ?? 0)} label="Best return · hold p50, days" />
          <Stat value={days(topScore.stay?.[5] ?? 0)} label="Best return · hold p75, days" />
          <Stat value={String(cells.length)} label="Combinations shown" />
        </Row>
      ) : null}

      <Stack gap={8}>
        <Text size="small" tone="secondary">
          {showMode === "pnl"
            ? "Min, avg, and max are the stock P&L for that value with the other filters applied."
            : "Min, avg, and max are the return for that value with the other filters applied."}{" "}
          The next three figures are that value's symbol count. The last three are its win rate.
        </Text>
        {RANGES.length > 0 ? (
          <Grid columns={2} gap={16} align="start">
            <FilterColumn
              label="Length"
              options={LENGTHS}
              selected={lengths}
              onChange={setLengths}
              format={(value) => value}
              moneyMode={showMode === "pnl"}
              stats={filterStats.length}
            />
            <FilterColumn
              label="Start month"
              options={STARTS}
              selected={starts}
              onChange={setStarts}
              format={(value) => value}
              moneyMode={showMode === "pnl"}
              stats={filterStats.start}
            />
          </Grid>
        ) : null}
        <Grid columns={2} gap={16} align="start">
          <FilterColumn
            label="Signal"
            options={SIGNALS}
            selected={books}
            onChange={setBooks}
            format={(value) => value}
            moneyMode={showMode === "pnl"}
            stats={filterStats.signal}
          />
          {SELL_MODE === "slots" ? (
            <Stack gap={4}>
              <Text>8 lots</Text>
              <Text size="small" tone="secondary">
                A new signal takes a free lot. On a full book, sell the biggest loss.
                If every lot is in profit, sell the least profitable one only when its
                strength is below the new signal. Strength is sqrt(analysts, capped at
                10) times the target percent floored to 10% steps.
              </Text>
            </Stack>
          ) : (SELL_MODE === "book" || SELL_MODE === "protect") && DROPS.some((value) => value !== 0) ? (
            <FilterColumn
              label="Loss dd"
              options={DROPS}
              selected={drops}
              onChange={setDrops}
              format={(value) => `${value}dd`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.drop}
            />
          ) : SELL_MODE === "book" && !(HOLDS.length === 1 && HOLDS[0] === 1) ? (
            <Stack gap={4}>
              <Text>Free lots</Text>
              <Text size="small" tone="secondary">
                No loss dropdown. A full book does not sell a lot to make room.
                One free lot buys the strongest signal. Two or three free lots
                buy the strongest two signals, one lot each. One signal takes
                one lot.
              </Text>
            </Stack>
          ) : SELL_MODE === "book" || SELL_MODE === "protect" ? (
            <Stack gap={4}>
              <Text>One position</Text>
              <Text size="small" tone="secondary">
                The whole book is one position. The strongest signal that day
                is bought at the next open. A new buy waits until that position
                has closed.
              </Text>
            </Stack>
          ) : (
            <FilterColumn
              label="Hold"
              options={HOLDS}
              selected={holds}
              onChange={setHolds}
              format={(value) => `${value}d`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.hold}
            />
          )}
          <FilterColumn
            label="Analysts"
            options={ANALYSTS}
            selected={analysts}
            onChange={setAnalysts}
            format={(value) => `>${value}`}
            moneyMode={showMode === "pnl"}
            stats={filterStats.analyst}
          />
          {SELL_MODE === "slots" ? (
            <div />
          ) : SELL_MODE === "book" || SELL_MODE === "protect" ? (
            <FilterColumn
              label="Profit protect"
              options={PROTECTS}
              selected={protects}
              onChange={setProtects}
              format={(value) => `${value}pp`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.protect}
            />
          ) : (
            <FilterColumn
              label="Target"
              options={TARGETS}
              selected={targets}
              onChange={setTargets}
              format={(value) => `${value}%`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.target}
            />
          )}
          <FilterColumn
            label="Upside"
            options={UPSIDES}
            selected={[upsideFloor]}
            onChange={(next) => setUpsideFloor(next[0])}
            format={(value) => `>${value}%`}
            moneyMode={showMode === "pnl"}
            stats={filterStats.upside}
            exclusive
          />
          {SELL_MODE === "book" ? (
            <FilterColumn
              label="Lots"
              options={HOLDS}
              selected={holds}
              onChange={setHolds}
              format={(value) => lotSplit(value)}
              moneyMode={showMode === "pnl"}
            stats={filterStats.hold}
            />
          ) : SELL_MODE === "slots" || SELL_MODE === "protect" ? (
            <div />
          ) : (
            <FilterColumn
              label="Drop"
              options={DROPS}
              selected={drops}
              onChange={setDrops}
              format={(value) => `${value}dd`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.drop}
            />
          )}
          <FilterColumn
            label="Symbols"
            options={SYMBOL_FLOORS}
            selected={[symbolFloor]}
            onChange={(next) => setSymbolFloor(next[0])}
            format={(value) => `>${value}`}
            moneyMode={showMode === "pnl"}
            stats={filterStats.symbol}
            exclusive
          />
          {FILLERS.length > 0 ? (
            <FilterColumn
              label="Stop filler"
              options={FILLERS}
              selected={[filler]}
              onChange={(next) => setFiller(next[0])}
              format={(value) => (value === "none" ? "no SPY" : value)}
              moneyMode={showMode === "pnl"}
            stats={filterStats.filler}
              exclusive
            />
          ) : null}
          {RULES.length > 0 ? (
            <FilterColumn
              label="Sell pick"
              options={RULES}
              selected={rules}
              onChange={setRules}
              format={(value) => value}
              moneyMode={showMode === "pnl"}
              stats={filterStats.rule}
            />
          ) : null}
          {SIZES.length > 0 ? (
            <FilterColumn
              label={SIZES.some((value) => value === "at" || value.startsWith("a×p/") || value === "a×t" || value === "a×p²" || value === "√a×p" || value === "t" || value === "a²") ? "Strength" : "Lot size"}
              options={SIZES}
              selected={sizes}
              onChange={setSizes}
              format={(value) => lotSizeLabel(value)}
              moneyMode={showMode === "pnl"}
              stats={filterStats.size}
            />
          ) : null}
          {ENTRIES.length > 0 ? (
            <FilterColumn
              label="Fill"
              options={ENTRIES}
              selected={entries}
              onChange={setEntries}
              format={(value) => value}
              moneyMode={showMode === "pnl"}
              stats={filterStats.entry}
            />
          ) : null}
        </Grid>
        <FilterGroup
          label="Show"
          options={SHOW_MODES}
          selected={[showMode]}
          onChange={(next) => setShowMode(next[0])}
          format={(value) => (value === "pct" ? "%" : value === "pnl" ? "$" : "Both")}
          exclusive
        />
      </Stack>

      {filled ? (
        <Stack gap={8}>
          <H2>Buy × sell</H2>
          <Text size="small" tone="secondary">
            Yellow is the smaller number and red is the larger one, on a scale fixed to the full
            grid. The min, average, and max columns sit on the left and summarize that buy across
            the sells in view. The min, average, and max rows sit at the top and do the same for
            each sell across the buys in view. Symbols are
            unique tickers in that buy, and the Symbols pill keeps buys above that floor. Signals
            are the lots opened. Click a heading to sort the buys. Click it again to reverse the
            order. The total rows stay at the top.
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
                    onClick={() => chooseSort("buy", false)}
                    style={sortStyle({ textAlign: "left", position: "sticky", left: 0, zIndex: 2 })}
                  >
                    Buy{sortMark("buy")}
                  </th>
                  <th
                    rowSpan={both ? 2 : 1}
                    onClick={() => chooseSort("sym", true)}
                    style={sortStyle({ textAlign: "right" })}
                  >
                    Symbols{sortMark("sym")}
                  </th>
                  <th
                    rowSpan={both ? 2 : 1}
                    onClick={() => chooseSort("n", true)}
                    style={sortStyle({ textAlign: "right" })}
                  >
                    Signals{sortMark("n")}
                  </th>
                  {STAT_NAMES.map((name) =>
                    both ? (
                      <th key={name} colSpan={2} style={head}>
                        {statLabel(name)}
                      </th>
                    ) : (
                      <th
                        key={name}
                        onClick={() => chooseSort(`stat:${name}:${activeMetric}`, true)}
                        style={sortStyle()}
                      >
                        {statLabel(name)}
                        {sortMark(`stat:${name}:${activeMetric}`)}
                      </th>
                    ),
                  )}
                  {view.sells.map(({ sell, col }, index) =>
                    both ? (
                      <th
                        key={sellLabel(sell)}
                        colSpan={2}
                        style={{
                          ...head,
                          borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                        }}
                      >
                        {sellLabel(sell)}
                      </th>
                    ) : (
                      <th
                        key={sellLabel(sell)}
                        onClick={() => chooseSort(`sell:${col}:${activeMetric}`, true)}
                        style={sortStyle({
                          borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                        })}
                      >
                        {sellLabel(sell)}
                        {sortMark(`sell:${col}:${activeMetric}`)}
                      </th>
                    ),
                  )}
                </tr>
                {both ? (
                  <tr>
                    {STAT_NAMES.flatMap((name) => [
                      <th
                        key={`${name}-pct`}
                        onClick={() => chooseSort(`stat:${name}:pct`, true)}
                        style={sortStyle()}
                      >
                        %{sortMark(`stat:${name}:pct`)}
                      </th>,
                      <th
                        key={`${name}-pnl`}
                        onClick={() => chooseSort(`stat:${name}:pnl`, true)}
                        style={sortStyle()}
                      >
                        ${sortMark(`stat:${name}:pnl`)}
                      </th>,
                    ])}
                    {view.sells.flatMap(({ sell, col }, index) => {
                      const name = sellLabel(sell);
                      const edge =
                        index === 0
                          ? { borderLeft: `1px solid ${theme.stroke.secondary}` }
                          : undefined;
                      return [
                        <th
                          key={`${name}-pct`}
                          onClick={() => chooseSort(`sell:${col}:pct`, true)}
                          style={sortStyle(edge)}
                        >
                          %{sortMark(`sell:${col}:pct`)}
                        </th>,
                        <th
                          key={`${name}-pnl`}
                          onClick={() => chooseSort(`sell:${col}:pnl`, true)}
                          style={sortStyle()}
                        >
                          ${sortMark(`sell:${col}:pnl`)}
                        </th>,
                      ];
                    })}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {STAT_NAMES.map((rowStat) => (
                  <tr key={rowStat}>
                    {labelCell(statLabel(rowStat), true, false)}
                    {countCell("—", false)}
                    {countCell("—", false)}
                    {STAT_NAMES.flatMap((colStat) =>
                      pair(
                        `${rowStat}-${colStat}`,
                        view.cornerRoi![rowStat][colStat],
                        view.cornerPnl![rowStat][colStat],
                        `${statLabel(rowStat)} of each buy's ${statLabel(colStat).toLowerCase()}`,
                      ),
                    )}
                    {view.sells.flatMap(({ sell }, index) => {
                      const name = sellLabel(sell);
                      return pair(
                        `${rowStat}-${name}`,
                        view.colRoi[index][rowStat],
                        view.colPnl[index][rowStat],
                        `${name} · ${statLabel(rowStat)} across buys`,
                        index === 0,
                      );
                    })}
                  </tr>
                ))}
                {orderedBuys.map(({ buy, row, index }, position) => (
                  <tr key={buyLabel(buy)}>
                    {labelCell(buy.n < 30 ? `${buyLabel(buy)} · thin` : buyLabel(buy), true, position === 0)}
                    {countCell(String(buy.sym), position === 0)}
                    {countCell(String(buy.n), position === 0)}
                    {STAT_NAMES.flatMap((name) =>
                      pair(
                        `${buyLabel(buy)}-${name}`,
                        view.rowRoi[index][name],
                        view.rowPnl[index][name],
                        `${buyLabel(buy)} · ${statLabel(name)} across sells`,
                      ),
                    )}
                    {view.sells.flatMap(({ sell, col }, sellIndex) => {
                      const name = `${buyLabel(buy)} · ${sellLabel(sell)}`;
                      const title = `${name} · ${FROM[row][col]} → ${TO[row][col]} · ${EXPOSED[row][col]} days exposed · ${LOTDAYS[row][col]} lot-days · ${share(LOTDAYUTIL[row][col])} of lot-days invested · avg lot ${lotMoney(AVGLOT[row][col])}`;
                      return pair(name, ROI[row][col], PNL[row][col], title, sellIndex === 0);
                    })}
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
          <H2>{byMoney ? "Lot exposure on the largest stock P&L" : "Lot exposure on the best returns"}</H2>
          <Text size="small" tone="secondary">
            {byMoney
              ? "Top 30 visible cells by stock P&L. "
              : "Top 30 visible cells by return on invested. "}
            Days utilized are distinct calendar days with a lot open. Lots utilized is the
            average share of the lot count that was open, including empty days. Lot-days are the
            sum of each lot's calendar hold. A 3-day lot, a 1-day lot, and another 3-day lot are
            6 lot-days. Lot-days invested is that sum divided by the lot count times the calendar
            days in the test, so a full book held every day is 100%. Symbols are distinct tickers
            in that cell: a ticker counts once when it has more than one lot or more than one
            signal. Positions are distinct entries: lots with the same ticker, buy date, and buy
            price count once. Hold is that position's calendar days, buy through sell.
            Several lots in one position count once. The lowest
            upside pill is the floor, and it includes 0% when that cut is in the run.
          </Text>
          <Table
            headers={
              SELL_MODE === "book"
                ? ["Sell", "Buy", "On invested", "Stock P&L", "Trade window", "Days utilized", "Lots utilized", "Lot-days", "Lot-days invested", "Avg lot", "Win", "Lots", "Symbols", "Positions", "Hold min", "Hold avg", "Hold max", "P25", "P50", "P75"]
                : ["Sell", "Buy", "On invested", "Stock P&L", "Trade window", "Days utilized", "Lots utilized", "Lot-days", "Avg lot", "Win", "Lots", "Symbols", "Positions", "Hold min", "Hold avg", "Hold max", "P25", "P50", "P75"]
            }
            columnAlign={
              SELL_MODE === "book"
                ? ["left", "left", "right", "right", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right"]
                : ["left", "left", "right", "right", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right"]
            }
            rows={ranked.map((cell) =>
              SELL_MODE === "book"
                ? [
                    cell.sell,
                    cell.buy,
                    pct(cell.roi),
                    money(cell.pnl),
                    `${cell.from} → ${cell.to}`,
                    String(cell.exposed),
                    pct(cell.lotsUtil),
                    String(cell.lotDays),
                    share(cell.lotDayUtil),
                    lotMoney(cell.avgLot),
                    pct(cell.win),
                    `${cell.closed}c/${cell.open}o`,
                    String(cell.symbols),
                    String(cell.positions),
                    days(cell.stay?.[0] ?? 0),
                    days(cell.stay?.[1] ?? 0),
                    days(cell.stay?.[2] ?? 0),
                    days(cell.stay?.[3] ?? 0),
                    days(cell.stay?.[4] ?? 0),
                    days(cell.stay?.[5] ?? 0),
                  ]
                : [
                    cell.sell,
                    cell.buy,
                    pct(cell.roi),
                    money(cell.pnl),
                    `${cell.from} → ${cell.to}`,
                    String(cell.exposed),
                    pct(cell.lotsUtil),
                    String(cell.lotDays),
                    lotMoney(cell.avgLot),
                    pct(cell.win),
                    `${cell.closed}c/${cell.open}o`,
                    String(cell.symbols),
                    String(cell.positions),
                    days(cell.stay?.[0] ?? 0),
                    days(cell.stay?.[1] ?? 0),
                    days(cell.stay?.[2] ?? 0),
                    days(cell.stay?.[3] ?? 0),
                    days(cell.stay?.[4] ?? 0),
                    days(cell.stay?.[5] ?? 0),
                  ],
            )}
            striped
            stickyHeader
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
