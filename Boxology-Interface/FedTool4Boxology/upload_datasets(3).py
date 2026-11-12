import sys
import os, io
import requests
from datetime import datetime
import json
import re
import csv
from SPARQLWrapper import SPARQLWrapper, POST, DIGEST, JSON

global organization
organization = ""
global group
group = ""

user_token = ""

API_Base_URL = "https://service.tib.eu/ldmservice/api/3/action/"
API_URL = API_Base_URL + "package_create"
request_headers = {'Authorization': user_token}

def sub_queries_generation(data):
	triples = data.split("\n")
	sub_group_triples = ""
	for triple in triples:
		if triple != "":
			sub_group_triples += triple + "\n"
			if triples.index(triple) == len(triples) // 2:
				if sub_group_triples.count("\n") >= 1400:
					sub_queries_generation(sub_group_triples)
				else:
					query = f"INSERT " + "{\n" + sub_group_triples + "}"
					#log.info(query)
					res = execute_sparql_sentence(query)
					if not res:
						print("ERROR executing sub_query")
						return res
				sub_group_triples = ""
	if sub_group_triples.count("\n") >= 1400:
		sub_queries_generation(sub_group_triples)
	else:
		query = f"INSERT " + "{\n" + sub_group_triples + "}"
		#log.info(query)
		res = execute_sparql_sentence(query)
		if not res:
			print("ERROR executing sub_query")
		return res

def execute_sparql_sentence(sparql_query):

	sparql = SPARQLWrapper("http://localhost:8890/sparql-auth", defaultGraph="http://tool4boxology.org/")
	sparql.setHTTPAuth(DIGEST)
	sparql.setCredentials("dba", "dba")
	sparql.setMethod(POST)
	sparql.setReturnFormat(JSON)

	sparql.setQuery(sparql_query)

	try:
		results = sparql.query()
	except:
		print("ERROR EXECUTING SPARQL QUERY: "+ sparql_query)
		return {}
	#return results.response.read()
	res = results.convert()
	res["SUCCESS"] = True

	if 'results' in res and 'bindings' in res['results']:
		if not res['results']['bindings']:
			print("ERROR EXECUTING SPARQL QUERY: " + sparql_query)
			return {}
	return res

def insert_dataset_into_graph(data):

	if data.count("\n") >= 1400:
		res = sub_queries_generation(data)
	else:
		sql = f"INSERT " + "{\n" + data + "}"
		res = execute_sparql_sentence(sql)
		if not res:
			print("ERROR inserting dataset")
	return res

def upload_endpoint(file):

	with open(file, 'r', encoding='utf-8') as f:
		data = f.read()
		insert_dataset_into_graph(data)

def dataset_organization_download():
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

	with open("metadata.json", "w") as f:
		json.dump(metadata, f)

def json_to_dataset(data):
	theme_groups = {"":""}
	dataset_catalog = {}
	generated = {}

	"""try:
			response = requests.get(API_Base_URL + "package_list", headers=request_headers)
		except requests.exceptions.RequestException as e:
			print("ERROR ACCESSING API: ", API_Base_URL + "package_list", e.__str__())
		packages = response.json().get('result')"""

	for row in data:
		if isinstance(row["dcterms:title"], str):
			if row["dcterms:title"] not in generated and len(row["dcterms:creator"]) > 0:
				resources = {}
				dataset_data = {}
				dataset_data["access_rights"] = row["dcterms:accessRights"]
				print(row["dcterms:creator"])
				if len(row["dcterms:creator"]) > 1: 
					dataset_data["extra_authors"] = []
					dataset_data["author"] = row["dcterms:creator"][0]
					i = 0
					for author in row["dcterms:creator"][1:]:
						dataset_data["extra_authors"].append({"extra_author":author, "orcid":""})
						#dataset_data["extras_authors"].append({"key":"orcid", "value":""})
						i += 1
				else:
					dataset_data["author"] = row["dcterms:creator"][0]

				dataset_data["notes"] = row["dcterms:description"]
				dataset_data["title"] = row["dcterms:title"]
				dataset_data["name"] = re.sub(r'[^a-zA-Z0-9\s]', '-',row["dcterms:title"].lower()).replace(" ","-")
				dataset_data["landing_page"] = row["dcat:landingPage"]
				dataset_data["version"] = row["dcterms:hasVersion"]
				dataset_data["owner_org"] = "tib"
				dataset_data["private"] = False
				dataset_data["author_email"] = ""
				dataset_data["citation"] = []
				dataset_data["defined_in"] = ""
				dataset_data["link_orkg"] = ""
				dataset_data["is_open"] = True
				dataset_data["state"] = "active"
				dataset_data["tags"] = []
				dataset_data["groups"] = []

				if "datacite:isDescribedBy" in row:
					if len(row["datacite:isDescribedBy"]) > 1:
						dataset_data["defined_in"] = "https://doi.org/" + row["datacite:isDescribedBy"][0]
						for citation in row["datacite:isDescribedBy"][1:]:
							dataset_data["citation"].append("https://doi.org/" + citation)
					elif len(row["datacite:isDescribedBy"]) == 1:
						dataset_data["defined_in"] = "https://doi.org/" + row["datacite:isDescribedBy"][0]
					else:
						dataset_data["citation"] = ""

				if "dcat:keyword" in row:
					for tag in row["dcat:keyword"]:
						dataset_data["tags"].append({"name":tag})


				if "dcat:theme" in row:
					for theme in row["dcat:theme"]:
						dataset_data["groups"].append({"name":theme.lower().replace(" ","-")})


				current_datetime_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
				resources["RDF-Data"] = {
					"package_id": dataset_data["name"],
					"created": current_datetime_str,
					"description": RDF_METADATA_DESCRIPTION,
					"format": "JSON",
					"name": "Original Metadata",
					"data": row,
					"url": ""
				}

				#if dataset_data["name"] not in packages:
				dataset_catalog[row["dcterms:title"]] = {"metadata":dataset_data,"resources":resources}

				generated[row["dcterms:title"]] = ""

	return dataset_catalog

def ldm_resource_upload(resource_dict):
	
	for resourceIRI in resource_dict:
		hadError = False
		print("---> Metadata of dataset:")
		print(json.dumps(resource_dict[resourceIRI]["metadata"], indent=4))
		data = {"id":resource_dict[resourceIRI]["metadata"]["name"]}
		response = requests.post(API_Base_URL + "package_show", data = data, headers=request_headers)
		print("---> GET response of dataset:")
		print(json.dumps(response.json(), indent=4))
		not_found = False
		result = response.json()
		if "error" in result:
			if "Not found" in result["error"]["message"]:
				not_found = True
		if not not_found:
			try:
				response = requests.post(API_Base_URL + "package_update", json = resource_dict[resourceIRI]["metadata"], headers=request_headers)
				print("---> Update of dataset response:")
				print(json.dumps(response.json(), indent=4))
			except requests.exceptions.RequestException as e:
				print("ERROR ACCESSING API: ", API_Base_URL + "package_update", e.__str__())
				hadError = True
			# print("---> Metadata of resources:")
			# print(json.dumps(resource_dict[resourceIRI]["resources"], indent=4))
			
		else:
			try:
				print(resource_dict[resourceIRI]["metadata"])
				response = requests.post(API_URL, json = resource_dict[resourceIRI]["metadata"], headers=request_headers)
				print("---> Creation of dataset response:")
				print(json.dumps(response.json(), indent=4))
			except requests.exceptions.RequestException as e:
				print("ERROR ACCESSING API: ", API_URL, e.__str__())
				hadError = True

		if not hadError:
			for resource in resource_dict[resourceIRI]["resources"]:
				print("---> Resource to be created:")
				print(json.dumps(resource_dict[resourceIRI]["resources"][resource], indent=4))
				try:
					resource_dict[resourceIRI]["resources"][resource]["package_id"] = resource_dict[resourceIRI]["metadata"]["name"]
					if resource_dict[resourceIRI]["resources"][resource]["description"] == RDF_METADATA_DESCRIPTION:
						# Create a temporary file
						temp_file_path = "./metadata.json"
						with open(temp_file_path, 'w') as temp_file:
							json.dump(resource_dict[resourceIRI]["resources"][resource]["data"],temp_file)  # Write content to the file
							#temp_file_path = temp_file.name  # Get the path of the temporary file
						with open(temp_file_path, 'rb') as f:
							#rdf_data = resource_dict[resourceIRI]["resources"][resource].pop("data")
							response = requests.post(API_Base_URL + "resource_create", data = resource_dict[resourceIRI]["resources"][resource], headers=request_headers, files={"upload":f})
						os.remove(temp_file_path)
					else:
						response = requests.post(API_Base_URL + "resource_create", json = resource_dict[resourceIRI]["resources"][resource], headers=request_headers)
					print("---> Creation of resource response:")
					print(json.dumps(response.json(), indent=4))
				except requests.exceptions.RequestException as e:
					print("ERROR ACCESSING API: ", API_Base_URL + "resource_create", e.__str__())

def download_metadata():
	metadata = []
	ROWS = 1000

	start = 0
	total = None

	while True:
		params = {
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

	with open("data_sources/metadata.json", "w") as f:
		json.dump(metadata, f)

def open_json_file(file_path):
	"""
	Opens and reads a JSON file.

	Args:
		file_path (str): The path to the JSON file.

	Returns:
		dict or list: Parsed JSON data (depends on the file content).
	"""
	try:
		with open(file_path, 'r', encoding='utf-8') as file:
			data = json.load(file)
			return data
	except FileNotFoundError:
		print(f"Error: The file '{file_path}' was not found.")
	except json.JSONDecodeError:
		print(f"Error: The file '{file_path}' is not a valid JSON file.")
	except Exception as e:
		print(f"An unexpected error occurred: {e}")

if __name__ == '__main__':
	#ldm_resource_upload(json_to_dataset(open_json_file("datasets.json")))
	#dataset_organization_download()
	upload_endpoint('virtuoso_endpoint/rdf/ntfiles/FedTool4Boxology.nt')