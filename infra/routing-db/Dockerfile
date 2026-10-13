FROM postgres@sha256:ec9f656f17c8b4dfebf49e58cf5c46d493d4846d4ea6d8b85d0637f68ee33bfc

USER root

COPY packages/ /opt/adresse-gn/localrepo/

RUN set -eux; \
    echo "2eb7e2f6b18c309954cbd6767f1921deba69929b0dfd92356a2f4440f8362024  /opt/adresse-gn/localrepo/postgresql-16-pgrouting-scripts_4.0.2-1.pgdg12+1_all.deb" | sha256sum -c -; \
    echo "9630090a40f11eaf1c7a06df790cccf5d61b7d8b10e87deac5957874a603b9de  /opt/adresse-gn/localrepo/postgresql-16-pgrouting_4.0.2-1.pgdg12+1_amd64.deb" | sha256sum -c -; \
    echo "7f1cc20734c34d881a4dbac581c90d40f29023ab069574f513760c0b1aeba4db  /opt/adresse-gn/localrepo/postgresql-16-postgis-3-scripts_3.6.4+dfsg-2.pgdg12+1_all.deb" | sha256sum -c -; \
    echo "1a6b00b16880716a4023bc0031bfc7534c50f5e05c0f4f75be7cc118717d2c82  /opt/adresse-gn/localrepo/postgresql-16-postgis-3_3.6.4+dfsg-2.pgdg12+1_amd64.deb" | sha256sum -c -; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        /opt/adresse-gn/localrepo/postgresql-16-postgis-3_3.6.4+dfsg-2.pgdg12+1_amd64.deb \
        /opt/adresse-gn/localrepo/postgresql-16-postgis-3-scripts_3.6.4+dfsg-2.pgdg12+1_all.deb \
        /opt/adresse-gn/localrepo/postgresql-16-pgrouting_4.0.2-1.pgdg12+1_amd64.deb \
        /opt/adresse-gn/localrepo/postgresql-16-pgrouting-scripts_4.0.2-1.pgdg12+1_all.deb; \
    rm -rf /var/lib/apt/lists/*; \
    rm -rf /opt/adresse-gn/localrepo

COPY verify-engine.sh /usr/local/bin/adresse-gn-verify-routing-engine

RUN chmod 0755 /usr/local/bin/adresse-gn-verify-routing-engine

EXPOSE 5432
