import json

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

def json_concat():
	json_file_path = "../NeSy-Example/JSONFiles/T4B-"
	i = 1
	new_file = []
	while i < 70:
		data = open_json_file(json_file_path + str(i) + ".json")
		if data != None:
			new_file.append(data)
		i += 1
	with open("original_kg.json", "w") as f:
		json.dump(new_file, f)

if __name__ == '__main__':
	json_concat()