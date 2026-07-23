import requests
import logging

API_Base_URL = "https://service.tib.eu/ldmservice/api/3/action/"
user_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJfTVk0VlpYcnZSR3k3Yl80R1NHeGJuRndacG5mQTJoNU1nc3NHSFJkRWFRaW9WZHBZVlE3U3dwNTVXNXN0QmExWkRTbHhndUdGUzdwRXlkNyIsImlhdCI6MTczMjUzMzk3M30.A2o-upDfs0we-erb-JLRyDAhmJaEXc0n6qoB1eprDuA"
request_headers = {'Authorization': user_token}

def get_paper_link_by_doi(doi):
    
    if "https://doi.org/" in doi:
        doi = doi.replace("https://doi.org/","")
    search_url = f"https://www.orkg.org/orkg/api/papers?doi={doi}"

    response = requests.get(search_url)

    if response.status_code == 200:
        data = response.json()
        if data["content"] != []:
            paper_id = data["content"][0]['id']
            paper_url = f"http://orkg.org/orkg/resource/{paper_id}"
            if paper_url == "http://orkg.org/orkg/resource/R1000":
                return ""
            else:
                return paper_url
        else:
            log.info("Paper not found in ORKG.")
            return None
    else:
        log.info(f"Error: {response.status_code}")
        return None

def find_dataset_by_source(doi):
    if "http://doi.org/" in doi:
        only_doi = doi.replace("http://doi.org/","")
    else:
        only_doi = doi
    params = {
        "fq": f"doi:"+only_doi
    }
    retrieve_response = requests.post(API_Base_URL + "package_search", headers=request_headers, params=params)
    retrieve_response.raise_for_status()
    data = retrieve_response.json()
    if retrieve_response.status_code == 200:
        result = data["result"]
        dataset = result["results"]
        return "https://service.tib.eu/ldmservice/dataset/" + dataset[0]["name"]
    else:
        params = {
        "fq": f"url:"+doi
        }
        retrieve_response = requests.post(API_Base_URL + "package_search", headers=request_headers, params=params)
        retrieve_response.raise_for_status()
        data = retrieve_response.json()
        if retrieve_response.status_code == 200:
            result = data["result"]
            dataset = result["results"]
            return "https://service.tib.eu/ldmservice/dataset/" + dataset["name"]
        else:
            return ""

def find_dataset_by_title(title):
    retrieve_response = requests.post(API_Base_URL + "package_search?q=title:"+title, headers=request_headers)
    retrieve_response.raise_for_status()
    data = retrieve_response.json()
    if retrieve_response.status_code == 200:
        result = data["result"]
        dataset = result["results"]
        return "https://service.tib.eu/ldmservice/dataset/" + dataset[0]["name"]
    else:
        return ""

def insert_dataset_ldm(package):
    respurces = {}
    package["organization"] = "tib"
    package["group"] = [{"id":"tool4boxology"}]
    RDF_METADATA_DESCRIPTION = "The json representation of the dataset with its distributions based on DCAT."
    current_datetime_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    resources["RDF-Data"] = {
        "package_id": package["name"],
        "created": current_datetime_str,
        "description": RDF_METADATA_DESCRIPTION,
        "format": "JSON",
        "name": "Original Metadata",
        "data": package,
        "url": ""
    }
    {"metadata":dataset_data,"resources":resources}
    try:
        print(package)
        response = requests.post(API_URL, json = package, headers=request_headers)
        print("---> Creation of dataset response:")
        print(json.dumps(response.json(), indent=4))
    except requests.exceptions.RequestException as e:
        print("ERROR ACCESSING API: ", API_URL, e.__str__())
        hadError = True

if __name__ == '__main__':
    print(find_dataset_by_source("10.25625/XMYQHO"))
    print(find_dataset_by_title("gtfs"))