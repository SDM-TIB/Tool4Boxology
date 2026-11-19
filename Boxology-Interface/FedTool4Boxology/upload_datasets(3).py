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
	except Exception as e:
		print("ERROR EXECUTING SPARQL QUERY: "+ sparql_query + str(e))
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


if __name__ == '__main__':
	#ldm_resource_upload(json_to_dataset(open_json_file("datasets.json")))
	#dataset_organization_download()
	upload_endpoint('ntfiles/FedTool4Boxology.nt')