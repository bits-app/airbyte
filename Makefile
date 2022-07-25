
SHELL := /bin/bash
TARGET_CONNECTORS := "<To_fill>"
REGISTRY_PATH := <To_fill>

.PHONY: help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

build: ## Build Connectors Docker Images
	@echo $(TARGET_CONNECTORS)
	for connector in $$(echo ${TARGET_CONNECTORS}); do \
		CONNECTOR_NAME=$${connector%%:*} && \
		TAG=$${connector#*:} && \
		cd airbyte-integrations/connectors/$$CONNECTOR_NAME && \
		docker build . -t airbyte/$$CONNECTOR_NAME:$$TAG --platform linux/amd64 && \
		cd ../../.. ;\
	done

deploy: ## Deploy to Bits Docker Registry
	@echo $(TARGET_CONNECTORS)
	for connector in $$(echo ${TARGET_CONNECTORS}); do \
		CONNECTOR_NAME=$${connector%%:*} && \
		TAG=$${connector#*:} && \
		docker tag airbyte/$$CONNECTOR_NAME:$$TAG $(REGISTRY_PATH)/airbyte/$$CONNECTOR_NAME:$$TAG && \
		docker push $(REGISTRY_PATH)/airbyte/$$CONNECTOR_NAME:$$TAG ;\
	done
