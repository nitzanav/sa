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

const ANALYSTS = [2, 3, 4, 5, 6];
const UPSIDES = [20, 25, 30];
const HOLDS = [10, 15, 30];
const TARGETS = [25, 50];
const DROPS = [7.5, 10];

type Buy = { a: number; p: number; n: number; sym: number };
type Sell = { h: number; t: number; d: number };

const BUYS: Buy[] = [{"a":2,"p":20,"n":1513,"sym":283},{"a":2,"p":25,"n":1035,"sym":221},{"a":2,"p":30,"n":711,"sym":159},{"a":3,"p":20,"n":1075,"sym":245},{"a":3,"p":25,"n":724,"sym":186},{"a":3,"p":30,"n":488,"sym":124},{"a":4,"p":20,"n":758,"sym":203},{"a":4,"p":25,"n":512,"sym":145},{"a":4,"p":30,"n":345,"sym":98},{"a":5,"p":20,"n":587,"sym":169},{"a":5,"p":25,"n":396,"sym":120},{"a":5,"p":30,"n":272,"sym":82},{"a":6,"p":20,"n":448,"sym":144},{"a":6,"p":25,"n":308,"sym":103},{"a":6,"p":30,"n":216,"sym":71}];
const SELLS: Sell[] = [{"h":10,"t":25,"d":7.5},{"h":10,"t":25,"d":10},{"h":10,"t":50,"d":7.5},{"h":10,"t":50,"d":10},{"h":15,"t":25,"d":7.5},{"h":15,"t":25,"d":10},{"h":15,"t":50,"d":7.5},{"h":15,"t":50,"d":10},{"h":30,"t":25,"d":7.5},{"h":30,"t":25,"d":10},{"h":30,"t":50,"d":7.5},{"h":30,"t":50,"d":10}];
const ROI: number[][] = [[0.7851,-3.54,-3.3122,-7.4906,-1.8619,-7.7864,-6.1301,-12.0059,-7.5134,-13.9032,-12.3336,-19.2898],[-9.5599,-13.8478,-14.9195,-18.6741,-10.3313,-15.3734,-16.4416,-21.2525,-15.447,-21.3737,-22.0345,-28.145],[-14.5485,-18.7985,-22.2352,-25.2659,-15.8044,-20.4152,-26.6906,-30.5432,-19.9997,-25.3747,-29.7515,-35.128],[3.6423,-0.9476,-1.6763,-6.1353,2.8451,-3.4408,-3.7687,-10.0338,-4.6821,-12.9757,-11.5102,-19.3903],[-7.307,-11.677,-12.7102,-16.3788,-7.5492,-13.2011,-15.225,-20.6712,-13.0626,-22.1538,-20.1636,-27.9827],[-7.8878,-12.0794,-16.2812,-18.6742,-9.3347,-15.4629,-23.6756,-28.4469,-13.8277,-24.6598,-25.487,-33.4843],[6.3913,3.4186,-1.9068,-5.3493,6.5843,1.6913,-3.8958,-9.7582,-0.9488,-9.7143,-10.4477,-19.4638],[-5.8337,-7.5444,-13.0456,-14.6777,-6.7594,-9.9222,-17.2044,-21.2759,-13.2017,-22.2242,-21.5576,-30.0446],[-7.5538,-8.2171,-17.6327,-16.7733,-9.7775,-11.2182,-27.8238,-29.0411,-13.8791,-25.8192,-28.7871,-38.2092],[7.8845,5.2314,-0.9186,-3.926,8.5771,3.0838,-3.0052,-8.8584,0.2435,-8.2269,-9.2553,-17.7498],[-6.676,-7.739,-15.1525,-15.6511,-8.8238,-12.805,-20.7469,-24.2658,-14.8997,-23.6579,-23.6155,-31.0978],[-8.2632,-8.3109,-19.7764,-17.8773,-11.1738,-14.3814,-31.1748,-32.3285,-13.6955,-26.5193,-28.8699,-38.1435],[5.1252,0.7236,-4.5742,-8.4115,4.6982,-2.762,-7.2901,-13.9713,-4.0974,-13.8822,-12.7173,-21.6458],[-7.153,-11.0996,-17.3741,-20.5758,-11.3023,-17.8881,-25.5528,-30.495,-18.3999,-28.8653,-28.1437,-36.4568],[-6.9433,-11.0446,-18.1678,-20.3946,-12.3575,-19.0745,-32.113,-35.8223,-14.6979,-30.4522,-28.469,-40.3758]];
const PNL: number[][] = [[2662.66,-12978.57,-11943.32,-29266.5,-7407.37,-34779.84,-26386.01,-58283.26,-34008.57,-74960.63,-62284.52,-118392.59],[-21439.34,-34327.78,-34863.99,-48329.82,-27296.61,-46768.06,-46074.02,-68968.25,-45874.39,-77411.78,-71550.63,-114208.58],[-21711.97,-31423.13,-34188.02,-43619.02,-27521.29,-41794.15,-48585.08,-65698.97,-38309.16,-60332.51,-61549.27,-92322.49],[8525.17,-2398.64,-4170.42,-16566.99,7748.31,-10475.19,-11085.03,-33305.21,-14551.29,-47986.99,-40069.55,-82093.88],[-11186.71,-19809.47,-20329.87,-29091.12,-13559.85,-27410.69,-29047.31,-45849.09,-26151.64,-54535.34,-44308.78,-77101.6],[-8068.02,-13826.92,-17161.39,-22105.7,-10907.87,-21322.29,-28963.5,-41320.14,-17481.2,-39167.8,-35002.6,-58699.42],[10057.33,5851.6,-3239.09,-9912.46,11926.87,3437.1,-7768.84,-21943.48,-1940.54,-23945.54,-24576.07,-55886.71],[-6061.67,-8794.82,-14310.42,-18071.47,-8071.83,-13835.61,-22221.68,-32200.1,-17416.91,-37194.5,-32068.26,-56970.41],[-5253.15,-6469.37,-12785.91,-13810.26,-7611.04,-10423.83,-23127.66,-28960.0,-11483.7,-27994.81,-26551.38,-46413.56],[9591.48,6880.47,-1210.5,-5612.94,12003.56,4839.45,-4646.55,-15448.29,387.41,-15794.06,-16976.72,-39734.29],[-5330.67,-6894.43,-12829.66,-14808.95,-8055.6,-13701.99,-20615.23,-28392.24,-15058.58,-30695.22,-26977.99,-45904.8],[-4479.72,-5066.72,-11238.39,-11475.04,-6724.12,-10373.59,-20200.31,-25239.2,-8756.06,-22386.63,-20765.83,-36342.86],[4757.1,723.23,-4587.0,-9109.58,5095.31,-3356.49,-8700.02,-18776.16,-5110.26,-20943.06,-18152.79,-37693.27],[-4446.14,-7648.59,-11451.9,-15061.07,-8112.43,-15018.7,-19942.85,-27964.05,-14813.3,-29876.36,-25572.18,-42730.33],[-2999.37,-5292.42,-8258.49,-10326.7,-5990.58,-10960.6,-16806.35,-22284.41,-7654.87,-20705.92,-16684.01,-30773.71]];
const EXPOSED: number[][] = [[265,265,265,265,267,267,267,267,267,267,267,267],[261,261,261,261,263,263,263,263,263,263,263,263],[257,257,257,257,263,263,263,263,263,263,263,263],[249,249,249,249,256,256,256,256,267,267,267,267],[242,242,242,242,249,249,249,249,260,260,260,260],[232,232,232,232,239,244,239,244,246,247,246,247],[216,216,220,220,222,222,226,226,222,222,234,234],[205,205,211,212,211,211,217,218,211,211,226,226],[180,180,186,187,186,191,192,198,186,200,201,215],[190,191,190,191,193,193,193,193,193,193,193,193],[176,177,176,177,179,179,179,179,179,179,179,179],[147,148,147,148,150,151,150,151,150,151,150,151],[169,169,169,169,173,174,173,174,173,174,173,174],[165,165,165,165,169,170,169,170,169,170,169,170],[146,146,146,146,149,150,149,150,149,150,149,150]];
const LOTDAYS: number[][] = [[19890,21309,20989,22542,23142,25768,24819,27787,26231,30945,29007,34959],[13235,14486,13757,15091,15427,17604,16273,18690,17261,20850,18755,23229],[8844,9776,9098,10080,10204,11844,10640,12415,11173,13688,12023,15069],[13719,14691,14463,15541,15833,17533,16951,18956,18019,21222,19996,24102],[9038,9902,9410,10332,10489,11999,11077,12747,11647,14171,12701,15773],[6042,6668,6215,6880,6840,7958,7140,8356,7378,9133,7975,10035],[9293,9994,9931,10702,10596,11758,11542,12875,11917,14194,13553,16374],[6179,6836,6489,7184,7042,8114,7556,8741,7737,9677,8638,10876],[4141,4612,4306,4808,4613,5413,4903,5781,4881,6273,5400,6984],[7209,7720,7727,8295,8202,9111,8962,10013,9290,11077,10587,12787],[4766,5254,5028,5550,5396,6249,5828,6781,5940,7514,6648,8476],[3242,3594,3389,3771,3571,4214,3825,4536,3777,4884,4217,5478],[5510,5877,5904,6308,6351,7045,6934,7728,7284,8705,8259,9964],[3722,4077,3927,4307,4247,4905,4591,5325,4745,6010,5305,6750],[2596,2836,2721,2983,2881,3359,3095,3618,3086,3944,3444,4391]];
const AVGLOT: number[][] = [[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0],[5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0,5000.0]];
const WIN: number[][] = [[47.7859,48.4468,46.1996,46.7944,46.1335,46.3979,43.9524,43.7541,43.3576,43.688,39.6563,38.8632],[42.8986,43.7681,42.2222,42.9952,40.4831,40.8696,39.2271,39.1304,37.7778,38.0676,35.5556,34.3961],[40.3657,41.6315,39.9437,41.0689,36.9902,37.6934,36.0056,36.0056,34.0366,34.0366,32.3488,30.5204],[47.6279,48.2791,45.8605,46.5116,46.7907,46.9767,44.2791,44.3721,43.2558,43.1628,38.8837,38.0465],[42.5414,43.5083,41.8508,42.8177,39.6409,39.6409,38.3978,38.1215,37.1547,36.4641,35.0829,33.4254],[40.5738,42.0082,40.1639,41.5984,36.8852,36.8852,35.8607,35.4508,34.4262,32.7869,32.7869,30.3279],[47.3615,48.285,44.8549,45.6464,47.7573,48.8127,44.4591,45.1187,44.723,44.0633,39.1821,37.467],[41.9922,43.3594,41.2109,42.3828,39.0625,40.625,37.8906,38.8672,37.3047,35.9375,34.9609,32.4219],[39.7101,41.7391,39.1304,41.1594,35.6522,37.971,34.4928,36.2319,33.913,31.5942,31.8841,28.4058],[48.2112,49.2334,45.6559,46.5077,48.552,49.5741,44.9744,45.4855,45.3152,44.6337,39.6934,37.6491],[41.9192,43.4343,40.9091,42.4242,37.6263,39.1414,36.1111,37.1212,36.3636,34.8485,33.8384,30.8081],[39.3382,41.5441,38.6029,40.8088,35.2941,37.5,33.8235,35.2941,34.1912,31.6176,31.9853,27.9412],[47.7679,48.6607,45.3125,46.2054,47.3214,47.7679,43.5268,43.75,43.5268,42.1875,37.7232,35.4911],[42.5325,43.8312,41.5584,42.8571,37.013,37.6623,35.3896,35.7143,35.0649,32.7922,32.4675,28.8961],[39.8148,41.6667,39.3519,41.2037,35.6481,36.5741,34.2593,34.7222,34.2593,30.5556,32.4074,27.3148]];
const CLOSED: number[][] = [[1216,1167,1159,1106,1178,1127,1108,1053,1164,1094,1085,1008],[842,807,839,804,804,767,785,748,794,747,770,722],[589,563,588,562,555,527,553,525,551,516,547,511],[859,822,815,774,825,787,777,735,818,769,763,709],[588,560,583,555,556,527,545,516,548,515,536,503],[394,375,392,373,377,356,375,354,375,352,368,345],[613,582,580,545,587,556,552,517,583,550,544,507],[417,393,412,388,402,378,393,369,397,371,384,358],[282,267,280,265,277,261,275,259,276,258,270,252],[483,462,458,434,463,442,437,413,461,438,432,406],[327,310,324,307,317,300,312,295,314,296,306,288],[225,214,225,214,221,209,221,209,221,208,218,205],[381,364,367,348,364,346,350,330,364,345,348,327],[264,252,264,252,255,242,255,242,255,242,252,239],[187,178,187,178,184,174,184,174,184,174,181,171]];
const OPENN: number[][] = [[297,346,354,407,335,386,405,460,349,419,428,505],[193,228,196,231,231,268,250,287,241,288,265,313],[122,148,123,149,156,184,158,186,160,195,164,200],[216,253,260,301,250,288,298,340,257,306,312,366],[136,164,141,169,168,197,179,208,176,209,188,221],[94,113,96,115,111,132,113,134,113,136,120,143],[145,176,178,213,171,202,206,241,175,208,214,251],[95,119,100,124,110,134,119,143,115,141,128,154],[63,78,65,80,68,84,70,86,69,87,75,93],[104,125,129,153,124,145,150,174,126,149,155,181],[69,86,72,89,79,96,84,101,82,100,90,108],[47,58,47,58,51,63,51,63,51,64,54,67],[67,84,81,100,84,102,98,118,84,103,100,121],[44,56,44,56,53,66,53,66,53,66,56,69],[29,38,29,38,32,42,32,42,32,42,35,45]];
const FROM: string[][] = [["2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29"],["2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02"],["2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02","2026-02-02"],["2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29"],["2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05"],["2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05"],["2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29"],["2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05"],["2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05","2026-02-05"],["2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29","2026-01-29"],["2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27","2026-04-27"],["2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05","2026-05-05"],["2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30","2026-04-30"],["2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04","2026-05-04"],["2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06","2026-05-06"]];
const TO: string[][] = [["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"],["2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22","2026-10-22"]];

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
        <H1>{"Coarse 7d-style buy/sell grid"}</H1>
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
