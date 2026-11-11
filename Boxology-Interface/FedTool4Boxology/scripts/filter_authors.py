
with open('../data/dataset_authors_old.csv', 'r', encoding="utf-8") as f:
	data = f.readlines()
	print(data)

with open('../data/evaluations2.csv', 'r', encoding="utf-8") as f:
	evaluations = f.readlines()
	print(evaluations)

dataset_ids = [evaluation.split(',')[1] for evaluation in evaluations][1:]
print(dataset_ids)

new_data = ['dataset_id,author_id\n']
for entry in data:
	#print(entry)
	for id in dataset_ids:
		#print(id)
		if id != '' and id in entry and entry not in new_data:
			new_data.append(entry)
			#print('match')

with open("../data/dataset_authors.csv", 'w', encoding="utf-8") as f:
	f.writelines(new_data)

with open('../data/authors_old.csv', 'r', encoding="utf-8") as f:
	authors = f.readlines()
	print(authors)

author_ids = [dataset_author.split(',')[1].replace('\n', '') for dataset_author in new_data][1:]
print(author_ids)


new_authors = ['author_id,author_name,orcid\n']

for author in authors:
	#print(author)
	for id in author_ids:
		#print(id)
		if id != '' and id in author and author not in new_authors:
			new_authors.append(author.replace(';', ''))
			print('match')

with open("../data/authors.csv", 'w', encoding="utf-8") as f:
	print(new_authors)
	f.writelines(new_authors)
