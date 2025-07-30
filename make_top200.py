import pandas as pd

# 1. Download the full residence CSV from the BRC Census site
url = "https://blackrockcitycensus.org/sociodemo/residence-outside.csv"
df = pd.read_csv(url)

# 2. Keep only U.S. entries and the top 200 by participant count
us = df[df['country_code'] == 'US'].copy()
us = us.sort_values('count', ascending=False).head(200)

# 3. Extract city and state from the 'residence' field
#    e.g. "Reno, NV, US" → "Reno, NV"
us['city_state'] = us['residence'].str.rsplit(',', n=1).str[0]

# 4. Write out just that column as a CSV
us[['city_state']].to_csv("top200_us_cities.csv", index=False, header=False)

print("Wrote top200_us_cities.csv with the 200 most popular U.S. origin cities.")