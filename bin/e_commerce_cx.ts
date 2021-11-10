#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ProductsFunctionStack } from '../lib/productsFunction-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsDbdStack } from '../lib/productsDbd-stack';

const app = new cdk.App();

const env = {
  region: "us-east-1",
  //account: "347563805954"
}

const tags = {
  cost: "ECommerceCX",
  team: "SiecolaCodeCX"
}

const productsDbdStack = new ProductsDbdStack(app, "ProductsDbd", {
  env: env,
  tags: tags
})

const productsFunctionStack = new ProductsFunctionStack(app, "ProductsFunction", {
  productsDbd: productsDbdStack.table,
  env: env,
  tags: tags
})
productsFunctionStack.addDependency(productsDbdStack)

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApi", {
  productsHandler: productsFunctionStack.handler,
  env: env,
  tags: tags
})
eCommerceApiStack.addDependency(productsFunctionStack)