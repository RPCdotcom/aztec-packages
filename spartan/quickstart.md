From the repo root:

```
./scripts/earthly-local ./yarn-project/+export-e2e-test-images
```

Then

```
AZTEC_DOCKER_TAG=<the tag that was spit out> NAMESPACE=smoke FRESH_INSTALL=true VALUES_FILE="3-validators-with-metrics.yaml" ./yarn-project/end-to-end/scripts/network_test.sh ./src/spartan/smoke.test.ts
```

Replace the values file and test with the ones you want to use.
