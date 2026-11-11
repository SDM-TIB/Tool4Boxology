import logging, requests, json
from orkg import ORKG, Hosts, OID

orkg = ORKG(host=Hosts.SANDBOX, creds=('', '')) # create  the connector to the ORKG

log = logging.getLogger(__name__)

def get_paper_by_title(title):

    search_url = f"https://orkg.org/api/papers?title={title}"

    response = requests.get(search_url)

    if response.status_code == 200:
        data = response.json()
        print(data["content"])
        if data["content"] != []:
            paper_id = data["content"][0]['id']
            paper_url = f"http://orkg.org/orkg/resource/{paper_id}"
            if paper_url == "http://orkg.org/orkg/resource/R1000":
                return []
            else:
                return data["content"][0]
        else:
            log.info("Paper not found in ORKG.")
            print("Paper not found in ORKG.")
            return None
    else:
        log.info(f"Error: {response.status_code}")
        print(f"Error: {response.status_code}")
        return None

# get titles of paper from csv file
with open('../data/papers.csv') as f:
    data = f.readlines()[1:]
    print(data)

# Fetch a list of papers by title
titles = [entry.split(';')[0] for entry in data]
papers = []
for title in titles:
    papers.append(get_paper_by_title(title))

# save JSON to file
with open('../data/papers.json', 'w') as outfile:
    json.dump({'papers': papers}, outfile)
