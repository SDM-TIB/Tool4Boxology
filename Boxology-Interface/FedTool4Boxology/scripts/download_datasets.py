import requests
import json


global organization
organization = "Leibniz Universität Hannover"
global group
group = "Tool4Boxology Semantic Ecosystem "

user_token = ""

API_Base_URL = "https://service.tib.eu/ldmservice/api/3/action/"
API_URL = API_Base_URL + "package_create"
request_headers = {'Authorization': user_token}


def download_metadata():
	metadata = []
	ROWS = 1000

	start = 0
	total = None

	while True:
		params = {
			"fq": f"organization:leibniz-universitat-hannover",
			"rows": ROWS,
			"start": start
		}

		retrieve_response = requests.post(API_Base_URL + "package_search", headers=request_headers, params=params)
		retrieve_response.raise_for_status()
		data = retrieve_response.json()

		result = data["result"]
		datasets = result["results"]

		if total is None:
			total = result["count"]
			print("Total datasets:", total)

		if not datasets:
			break

		metadata += datasets

		start += ROWS
		print(f"Processed {min(start, total)} / {total}")

	with open("../data/metadata.json", "w") as f:
		json.dump(metadata, f)


if __name__ == '__main__':
	download_metadata()
