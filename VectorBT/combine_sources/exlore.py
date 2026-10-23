import pandas as pd

y = pd.read_csv("data/analyst_recomendation/yahoo/all_symbols.csv")
g = pd.read_csv("data/analyst_recomendation/google/all_symbols.csv")
for n, d in [("yahoo", y), ("google", g)]:
    print(n, d.shape)
    print(d.head(3).T)
    print(d.nunique())
