# Download base image (Virtuoso so that we can load data to remote endpoint)
FROM kemele/virtuoso:7-stable
ARG DEBIAN_FRONTEND=noninteractive
USER root
WORKDIR /data

#RUN add-apt-repository ppa:deadsnakes/ppa &&
RUN apt-get update
RUN apt install software-properties-common -y
#RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get update
RUN apt-get install python3 -y
RUN apt-get install -y --no-install-recommends gcc libpq-dev nano git python3-pip python3-dev
RUN apt-get install -y --no-install-recommends postgresql
RUN apt-get install -y python3-setuptools
RUN apt-get update
RUN python3 -m pip install psycopg2
RUN python3 -m pip install Flask==1.1.4

# Install SDM-RDFizer
#RUN python3 -m pip install cython
#RUN python3 -m pip install numpy
RUN python3 -m pip install rdfizer


CMD ["tail", "-f", "/dev/null"]