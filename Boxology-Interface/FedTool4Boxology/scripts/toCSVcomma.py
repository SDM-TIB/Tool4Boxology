
with open("../data/evaluations.csv", 'r') as f:
	data = f.readlines()
with open("../data/evaluations2.csv", 'w') as f:
	print(data)
	new = []
	for line in data:
		line = line.replace(';', ',')
		line += ';'
		new.append(line)
	f.writelines(new)
