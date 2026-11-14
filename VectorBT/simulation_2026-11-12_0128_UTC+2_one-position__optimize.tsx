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

const SOURCE = "yahoo_and_tipranks_1d_recency \u00b7 yahoo_and_tipranks_2d_recency \u00b7 yahoo_and_tipranks_3d_recency \u00b7 yahoo_and_tipranks_4d_recency \u00b7 yahoo_and_tipranks_5d_recency \u00b7 yahoo_and_tipranks_any_recency \u00b7 2026-01-02 \u2192 2026-10-26 \u00b7 205 trading days \u00b7 one position of $320,000. The strongest signal that day is bought. A new buy waits until that position has closed. Upside filter includes >30%. Days utilized are calendar days with at least one lot open. Lots utilized is the average open lots divided by the lot count. Lot-days invested is the sum of each lot's calendar hold divided by the lot count times the calendar days in the test. Lot-days add each lot's calendar hold, so overlapping lots count again. Win rate counts a position once: lots with the same ticker, buy date, and buy price are one position. Hold is that position's calendar days, buy through sell. Several lots in one position count once. Buys stop on the last day of each range. Prices continue 6 calendar days, the p80 calendar hold of closed lots on 7.5dd 5pp \u00b7 ls \u00b7 at. A lot still open at the end of that grace stays open.";
const TITLE = "One position, recency union, next open";

const SIGNALS = ["yahoo_and_tipranks_any_recency"];
const ANALYSTS = [0, 1, 2, 3];
const UPSIDES = [30, 40];
const HOLDS = [1];
const TARGETS = [0];
const DROPS = [0];
const PROTECTS = [5, 10, 15];
const FILLERS: string[] = [];
const RULES: string[] = ["nb"];
const SIZES: string[] = ["a\u00d7t", "a\u00d7p\u00b2", "\u221aa\u00d7p", "t", "a\u00b2"];
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

const BUYS: Buy[] = [{"s":"yahoo_and_tipranks_any_recency","a":0,"p":30,"n":1496,"sym":333,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":0,"p":40,"n":747,"sym":214,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":1,"p":30,"n":1496,"sym":333,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":1,"p":40,"n":747,"sym":214,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":30,"n":1496,"sym":333,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":2,"p":40,"n":747,"sym":214,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":30,"n":798,"sym":234,"w":"10m_Jan-Oct"},{"s":"yahoo_and_tipranks_any_recency","a":3,"p":40,"n":370,"sym":120,"w":"10m_Jan-Oct"}];
const SELLS: Sell[] = [{"h":1,"t":0,"d":0,"p":5,"f":"","r":"nb","z":"a\u00d7t","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":10,"f":"","r":"nb","z":"a\u00d7t","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":15,"f":"","r":"nb","z":"a\u00d7t","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":5,"f":"","r":"nb","z":"a\u00d7p\u00b2","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":10,"f":"","r":"nb","z":"a\u00d7p\u00b2","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":15,"f":"","r":"nb","z":"a\u00d7p\u00b2","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":5,"f":"","r":"nb","z":"\u221aa\u00d7p","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":10,"f":"","r":"nb","z":"\u221aa\u00d7p","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":15,"f":"","r":"nb","z":"\u221aa\u00d7p","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":5,"f":"","r":"nb","z":"t","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":10,"f":"","r":"nb","z":"t","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":15,"f":"","r":"nb","z":"t","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":5,"f":"","r":"nb","z":"a\u00b2","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":10,"f":"","r":"nb","z":"a\u00b2","m":320000.0,"e":"next open"},{"h":1,"t":0,"d":0,"p":15,"f":"","r":"nb","z":"a\u00b2","m":320000.0,"e":"next open"}];
const ENTRIES: string[] = [];
for (const sell of SELLS) {
  if (sell.e && !ENTRIES.includes(sell.e)) ENTRIES.push(sell.e);
}
const ROI: number[][] = [[52.1076,26.6542,23.3947,61.6249,18.0766,14.7104,61.6249,18.0766,14.7104,64.5276,62.7973,83.5102,-25.2775,-25.2775,-25.2775],[57.2919,55.6046,59.658,55.3739,53.7089,57.7837,55.3739,53.7089,57.7837,64.5276,62.7973,66.8697,81.3591,79.2658,84.0105],[52.1076,26.6542,23.3947,61.6249,18.0766,14.7104,61.6249,18.0766,14.7104,64.5276,62.7973,83.5102,-25.2775,-25.2775,-25.2775],[57.2919,55.6046,59.658,55.3739,53.7089,57.7837,55.3739,53.7089,57.7837,64.5276,62.7973,66.8697,81.3591,79.2658,84.0105],[52.1076,26.6542,23.3947,61.6249,18.0766,14.7104,61.6249,18.0766,14.7104,64.5276,62.7973,83.5102,-25.2775,-25.2775,-25.2775],[57.2919,55.6046,59.658,55.3739,53.7089,57.7837,55.3739,53.7089,57.7837,64.5276,62.7973,66.8697,81.3591,79.2658,84.0105],[-19.7865,-19.7865,-15.2582,-10.8155,15.9319,36.025,-10.8155,15.9319,36.025,21.0895,21.0895,-2.4163,-10.6868,-10.6868,-10.6868],[25.8327,25.522,24.3203,25.8327,25.522,24.3203,25.8327,25.522,24.3203,54.1377,43.7923,42.2521,52.9948,52.4445,50.5439]];
const PNL: number[][] = [[152916.6,75307.82,65002.92,175074.81,51637.44,41332.54,175074.81,51637.44,41332.54,189365.03,187227.94,221607.45,-72996.55,-72996.55,-72996.55],[160976.37,158839.27,165761.9,154722.81,152585.72,160553.99,154722.81,152585.72,160553.99,189365.03,187227.94,194150.57,227329.25,225192.16,232114.79],[152916.6,75307.82,65002.92,175074.81,51637.44,41332.54,175074.81,51637.44,41332.54,189365.03,187227.94,221607.45,-72996.55,-72996.55,-72996.55],[160976.37,158839.27,165761.9,154722.81,152585.72,160553.99,154722.81,152585.72,160553.99,189365.03,187227.94,194150.57,227329.25,225192.16,232114.79],[152916.6,75307.82,65002.92,175074.81,51637.44,41332.54,175074.81,51637.44,41332.54,189365.03,187227.94,221607.45,-72996.55,-72996.55,-72996.55],[160976.37,158839.27,165761.9,154722.81,152585.72,160553.99,154722.81,152585.72,160553.99,189365.03,187227.94,194150.57,227329.25,225192.16,232114.79],[-46638.26,-46638.26,-36917.37,-24480.05,36557.77,83788.93,-24480.05,36557.77,83788.93,50697.16,50697.16,-5846.36,-26023.77,-26023.77,-26023.77],[47179.4,47010.23,45935.67,47179.4,47010.23,45935.67,47179.4,47010.23,45935.67,105634.49,86815.47,85740.9,95132.08,94962.91,93888.35]];
const EXPOSED: number[][] = [[287,283,285,285,285,287,285,285,287,289,293,280,290,290,290],[283,287,284,283,287,284,283,287,284,289,293,290,285,289,286],[287,283,285,285,285,287,285,285,287,289,293,280,290,290,290],[283,287,284,283,287,284,283,287,284,289,293,290,285,289,286],[287,283,285,285,285,287,285,285,287,289,293,280,290,290,290],[283,287,284,283,287,284,283,287,284,289,293,290,285,289,286],[242,242,241,240,244,241,240,244,241,241,241,241,245,245,245],[195,195,200,195,195,200,195,195,200,196,200,205,197,197,202]];
const LOTUTIL: number[][] = [[91.7073,88.2927,86.8293,88.7805,89.2683,87.8049,88.7805,89.2683,87.8049,91.7073,93.1707,82.9268,90.2439,90.2439,90.2439],[87.8049,89.2683,86.8293,87.3171,88.7805,86.8293,87.3171,88.7805,86.8293,91.7073,93.1707,90.7317,87.3171,88.7805,86.3415],[91.7073,88.2927,86.8293,88.7805,89.2683,87.8049,88.7805,89.2683,87.8049,91.7073,93.1707,82.9268,90.2439,90.2439,90.2439],[87.8049,89.2683,86.8293,87.3171,88.7805,86.8293,87.3171,88.7805,86.8293,91.7073,93.1707,90.7317,87.3171,88.7805,86.3415],[91.7073,88.2927,86.8293,88.7805,89.2683,87.8049,88.7805,89.2683,87.8049,91.7073,93.1707,82.9268,90.2439,90.2439,90.2439],[87.8049,89.2683,86.8293,87.3171,88.7805,86.8293,87.3171,88.7805,86.8293,91.7073,93.1707,90.7317,87.3171,88.7805,86.3415],[73.6585,73.6585,75.6098,70.7317,71.7073,72.6829,70.7317,71.7073,72.6829,75.122,75.122,75.6098,76.0976,76.0976,76.0976],[57.0732,57.561,59.0244,57.0732,57.561,59.0244,57.0732,57.561,59.0244,60.9756,61.9512,63.4146,56.0976,56.5854,58.0488]];
const LOTDAYS: number[][] = [[287,283,285,285,285,287,285,285,287,289,293,280,290,290,290],[283,287,284,283,287,284,283,287,284,289,293,290,285,289,286],[287,283,285,285,285,287,285,285,287,289,293,280,290,290,290],[283,287,284,283,287,284,283,287,284,289,293,290,285,289,286],[287,283,285,285,285,287,285,285,287,289,293,280,290,290,290],[283,287,284,283,287,284,283,287,284,289,293,290,285,289,286],[242,242,241,240,244,241,240,244,241,241,241,241,245,245,245],[195,195,200,195,195,200,195,195,200,196,200,205,197,197,202]];
const LOTDAYUTIL: number[][] = [[96.3087,94.9664,95.6376,95.6376,95.6376,96.3087,95.6376,95.6376,96.3087,96.9799,98.3221,93.9597,97.3154,97.3154,97.3154],[94.9664,96.3087,95.302,94.9664,96.3087,95.302,94.9664,96.3087,95.302,96.9799,98.3221,97.3154,95.6376,96.9799,95.9732],[96.3087,94.9664,95.6376,95.6376,95.6376,96.3087,95.6376,95.6376,96.3087,96.9799,98.3221,93.9597,97.3154,97.3154,97.3154],[94.9664,96.3087,95.302,94.9664,96.3087,95.302,94.9664,96.3087,95.302,96.9799,98.3221,97.3154,95.6376,96.9799,95.9732],[96.3087,94.9664,95.6376,95.6376,95.6376,96.3087,95.6376,95.6376,96.3087,96.9799,98.3221,93.9597,97.3154,97.3154,97.3154],[94.9664,96.3087,95.302,94.9664,96.3087,95.302,94.9664,96.3087,95.302,96.9799,98.3221,97.3154,95.6376,96.9799,95.9732],[81.2081,81.2081,80.8725,80.5369,81.8792,80.8725,80.5369,81.8792,80.8725,80.8725,80.8725,80.8725,82.2148,82.2148,82.2148],[65.4362,65.4362,67.1141,65.4362,65.4362,67.1141,65.4362,65.4362,67.1141,65.7718,67.1141,68.7919,66.1074,66.1074,67.7852]];
const AVGLOT: number[][] = [[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0],[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0],[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0],[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0],[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0],[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0],[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0],[320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0,320000.0]];
const WIN: number[][] = [[66.6667,72.7273,68.0,57.1429,65.0,60.8696,57.1429,65.0,60.8696,66.6667,64.2857,62.5,63.1579,63.1579,63.1579],[52.1739,50.0,54.1667,54.1667,52.1739,54.1667,54.1667,52.1739,54.1667,66.6667,64.2857,68.75,58.3333,56.5217,60.0],[66.6667,72.7273,68.0,57.1429,65.0,60.8696,57.1429,65.0,60.8696,66.6667,64.2857,62.5,63.1579,63.1579,63.1579],[52.1739,50.0,54.1667,54.1667,52.1739,54.1667,54.1667,52.1739,54.1667,66.6667,64.2857,68.75,58.3333,56.5217,60.0],[66.6667,72.7273,68.0,57.1429,65.0,60.8696,57.1429,65.0,60.8696,66.6667,64.2857,62.5,63.1579,63.1579,63.1579],[52.1739,50.0,54.1667,54.1667,52.1739,54.1667,54.1667,52.1739,54.1667,66.6667,64.2857,68.75,58.3333,56.5217,60.0],[54.5455,54.5455,63.1579,50.0,53.8462,64.0,50.0,53.8462,64.0,60.0,60.0,57.8947,55.5556,55.5556,55.5556],[56.6667,58.0645,58.0645,56.6667,58.0645,58.0645,56.6667,58.0645,58.0645,66.6667,66.6667,66.6667,62.5,63.6364,63.6364]];
const CLOSED: number[][] = [[14,21,24,20,19,22,20,19,22,14,13,31,18,18,18],[22,21,23,23,22,23,23,22,23,14,13,15,23,22,24],[14,21,24,20,19,22,20,19,22,14,13,31,18,18,18],[22,21,23,23,22,23,23,22,23,14,13,15,23,22,24],[14,21,24,20,19,22,20,19,22,14,13,31,18,18,18],[22,21,23,23,22,23,23,22,23,14,13,15,23,22,24],[21,21,18,27,25,24,27,25,24,19,19,18,17,17,17],[29,30,30,29,30,30,29,30,30,20,20,20,31,32,32]];
const OPENN: number[][] = [[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]];
const SYMBOLS: number[][] = [[14,21,23,18,18,21,18,18,21,14,13,28,18,18,18],[17,17,19,18,18,19,18,18,19,14,13,15,20,19,21],[14,21,23,18,18,21,18,18,21,14,13,28,18,18,18],[17,17,19,18,18,19,18,18,19,14,13,15,20,19,21],[14,21,23,18,18,21,18,18,21,14,13,28,18,18,18],[17,17,19,18,18,19,18,18,19,14,13,15,20,19,21],[20,20,18,24,23,22,24,23,22,18,18,17,16,16,16],[24,25,25,24,25,25,24,25,25,17,17,17,25,26,26]];
const POSITIONS: number[][] = [[15,22,25,21,20,23,21,20,23,15,14,32,19,19,19],[23,22,24,24,23,24,24,23,24,15,14,16,24,23,25],[15,22,25,21,20,23,21,20,23,15,14,32,19,19,19],[23,22,24,24,23,24,24,23,24,15,14,16,24,23,25],[15,22,25,21,20,23,21,20,23,15,14,32,19,19,19],[23,22,24,24,23,24,24,23,24,15,14,16,24,23,25],[22,22,19,28,26,25,28,26,25,20,20,19,18,18,18],[30,31,31,30,31,31,30,31,31,21,21,21,32,33,33]];
const STAY: number[][][] = [[[2.0,19.1333,99.0,3.5,7.0,14.5],[2.0,12.8636,78.0,4.0,7.0,10.75],[2.0,11.4,78.0,3.0,5.0,10.0],[2.0,13.5714,99.0,4.0,7.0,13.0],[2.0,14.25,51.0,4.0,7.5,16.75],[2.0,12.4783,51.0,3.5,5.0,11.0],[2.0,13.5714,99.0,4.0,7.0,13.0],[2.0,14.25,51.0,4.0,7.5,16.75],[2.0,12.4783,51.0,3.5,5.0,11.0],[2.0,19.2667,99.0,4.5,11.0,14.5],[2.0,20.9286,99.0,6.0,10.0,18.25],[2.0,8.75,31.0,3.0,5.0,12.25],[2.0,15.2632,78.0,5.0,7.0,19.0],[2.0,15.2632,78.0,5.0,7.0,19.0],[2.0,15.2632,78.0,5.0,7.0,19.0]],[[2.0,12.3043,99.0,4.0,5.0,12.5],[2.0,13.0455,99.0,4.0,6.0,15.25],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,11.7917,99.0,3.75,5.0,12.25],[2.0,12.4783,99.0,4.0,5.0,14.5],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,11.7917,99.0,3.75,5.0,12.25],[2.0,12.4783,99.0,4.0,5.0,14.5],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,19.2667,99.0,4.5,11.0,14.5],[2.0,20.9286,99.0,6.0,10.0,18.25],[2.0,18.125,99.0,4.0,7.0,14.5],[2.0,11.875,99.0,3.0,5.0,11.5],[2.0,12.5652,99.0,3.5,6.0,14.5],[2.0,11.44,99.0,3.0,5.0,10.0]],[[2.0,19.1333,99.0,3.5,7.0,14.5],[2.0,12.8636,78.0,4.0,7.0,10.75],[2.0,11.4,78.0,3.0,5.0,10.0],[2.0,13.5714,99.0,4.0,7.0,13.0],[2.0,14.25,51.0,4.0,7.5,16.75],[2.0,12.4783,51.0,3.5,5.0,11.0],[2.0,13.5714,99.0,4.0,7.0,13.0],[2.0,14.25,51.0,4.0,7.5,16.75],[2.0,12.4783,51.0,3.5,5.0,11.0],[2.0,19.2667,99.0,4.5,11.0,14.5],[2.0,20.9286,99.0,6.0,10.0,18.25],[2.0,8.75,31.0,3.0,5.0,12.25],[2.0,15.2632,78.0,5.0,7.0,19.0],[2.0,15.2632,78.0,5.0,7.0,19.0],[2.0,15.2632,78.0,5.0,7.0,19.0]],[[2.0,12.3043,99.0,4.0,5.0,12.5],[2.0,13.0455,99.0,4.0,6.0,15.25],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,11.7917,99.0,3.75,5.0,12.25],[2.0,12.4783,99.0,4.0,5.0,14.5],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,11.7917,99.0,3.75,5.0,12.25],[2.0,12.4783,99.0,4.0,5.0,14.5],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,19.2667,99.0,4.5,11.0,14.5],[2.0,20.9286,99.0,6.0,10.0,18.25],[2.0,18.125,99.0,4.0,7.0,14.5],[2.0,11.875,99.0,3.0,5.0,11.5],[2.0,12.5652,99.0,3.5,6.0,14.5],[2.0,11.44,99.0,3.0,5.0,10.0]],[[2.0,19.1333,99.0,3.5,7.0,14.5],[2.0,12.8636,78.0,4.0,7.0,10.75],[2.0,11.4,78.0,3.0,5.0,10.0],[2.0,13.5714,99.0,4.0,7.0,13.0],[2.0,14.25,51.0,4.0,7.5,16.75],[2.0,12.4783,51.0,3.5,5.0,11.0],[2.0,13.5714,99.0,4.0,7.0,13.0],[2.0,14.25,51.0,4.0,7.5,16.75],[2.0,12.4783,51.0,3.5,5.0,11.0],[2.0,19.2667,99.0,4.5,11.0,14.5],[2.0,20.9286,99.0,6.0,10.0,18.25],[2.0,8.75,31.0,3.0,5.0,12.25],[2.0,15.2632,78.0,5.0,7.0,19.0],[2.0,15.2632,78.0,5.0,7.0,19.0],[2.0,15.2632,78.0,5.0,7.0,19.0]],[[2.0,12.3043,99.0,4.0,5.0,12.5],[2.0,13.0455,99.0,4.0,6.0,15.25],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,11.7917,99.0,3.75,5.0,12.25],[2.0,12.4783,99.0,4.0,5.0,14.5],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,11.7917,99.0,3.75,5.0,12.25],[2.0,12.4783,99.0,4.0,5.0,14.5],[2.0,11.8333,99.0,4.0,5.0,12.25],[2.0,19.2667,99.0,4.5,11.0,14.5],[2.0,20.9286,99.0,6.0,10.0,18.25],[2.0,18.125,99.0,4.0,7.0,14.5],[2.0,11.875,99.0,3.0,5.0,11.5],[2.0,12.5652,99.0,3.5,6.0,14.5],[2.0,11.44,99.0,3.0,5.0,10.0]],[[2.0,11.0,78.0,2.0,5.0,8.0],[2.0,11.0,78.0,2.0,5.0,8.0],[2.0,12.6842,78.0,2.5,5.0,9.0],[2.0,8.5714,28.0,2.75,5.0,12.0],[2.0,9.3846,28.0,2.25,6.0,13.75],[2.0,9.64,47.0,3.0,5.0,12.0],[2.0,8.5714,28.0,2.75,5.0,12.0],[2.0,9.3846,28.0,2.25,6.0,13.75],[2.0,9.64,47.0,3.0,5.0,12.0],[2.0,12.05,70.0,3.75,5.0,12.25],[2.0,12.05,70.0,3.75,5.0,12.25],[2.0,12.6842,70.0,3.0,5.0,17.5],[2.0,13.6111,78.0,4.25,6.0,8.0],[2.0,13.6111,78.0,4.25,6.0,8.0],[2.0,13.6111,78.0,4.25,6.0,8.0]],[[2.0,6.5,25.0,2.25,5.0,8.0],[2.0,6.2903,25.0,2.0,5.0,8.0],[2.0,6.4516,25.0,2.5,5.0,8.0],[2.0,6.5,25.0,2.25,5.0,8.0],[2.0,6.2903,25.0,2.0,5.0,8.0],[2.0,6.4516,25.0,2.5,5.0,8.0],[2.0,6.5,25.0,2.25,5.0,8.0],[2.0,6.2903,25.0,2.0,5.0,8.0],[2.0,6.4516,25.0,2.5,5.0,8.0],[2.0,9.3333,70.0,2.0,5.0,8.0],[2.0,9.5238,70.0,2.0,6.0,8.0],[2.0,9.7619,70.0,3.0,6.0,8.0],[2.0,6.1562,25.0,2.75,5.0,8.0],[2.0,5.9697,25.0,2.0,5.0,8.0],[2.0,6.1212,25.0,3.0,5.0,8.0]]];
const FROM: string[][] = [["2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05"],["2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05","2026-01-05"],["2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28","2026-01-28"],["2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09","2026-02-09"]];
const TO: string[][] = [["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"],["2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26","2026-10-26"]];

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
    if (!sell.d && sell.h === 1) {
      return [sell.p ? `${sell.p}pp` : "", lotSizeLabel(sell.z)].filter(Boolean).join(" · ");
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
