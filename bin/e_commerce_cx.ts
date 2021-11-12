#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ProductsFunctionStack } from '../lib/productsFunction-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsDdbStack } from '../lib/productsDdb-stack';
import { EventsDdbStack } from '../lib/eventsDdb-stack';

const app = new cdk.App();

const env = {
  region: "us-east-1",
  //account: "347563805954"
}

const tags = {
  cost: "ECommerceCX",
  team: "SiecolaCodeCX"
} 

const eventsDdbStack = new EventsDdbStack(app, "EventsDdb", {
  env: env,
  tags: tags,
})

const productsDdbStack = new ProductsDdbStack(app, "ProductsDdb", {
  env: env,
  tags: tags,
  //terminationProtection: true
})

const productsFunctionStack = new ProductsFunctionStack(app, "ProductsFunction", {
  productsDdb: productsDdbStack.table,
  eventsDdb: eventsDdbStack.table,
  env: env,
  tags: tags
})
productsFunctionStack.addDependency(productsDdbStack)
productsFunctionStack.addDependency(eventsDdbStack)

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApi", {
  productsHandler: productsFunctionStack.productsHandler,
  env: env,
  tags: tags
})
eCommerceApiStack.addDependency(productsFunctionStack)