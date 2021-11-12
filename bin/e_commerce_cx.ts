#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ProductsFunctionStack } from '../lib/productsFunction-stack';
import { ECommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsDbdStack } from '../lib/productsDbd-stack';
import { EventsDbdStack } from '../lib/eventsDdb-stack';


const app = new cdk.App();

const env = {
  region: "us-east-1",
  //account: "347563805954"
}

const tags = {
  cost: "ECommerceCX",
  team: "SiecolaCodeCX"
}

const eventsDbdStack = new EventsDbdStack(app, "EventsDdb", {
  env: env,
  tags: tags,
})

const productsDbdStack = new ProductsDbdStack(app, "ProductsDbd", {
  env: env,
  tags: tags,
  terminationProtection: true
})

const productsFunctionStack = new ProductsFunctionStack(app, "ProductsFunction", {
  productsDbd: productsDbdStack.table,
  eventsDdb: eventsDbdStack.table,
  env: env,
  tags: tags
})
productsFunctionStack.addDependency(productsDbdStack)
productsFunctionStack.addDependency(eventsDbdStack)

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApi", {
  productsHandler: productsFunctionStack.productsHander,
  env: env,
  tags: tags
})
eCommerceApiStack.addDependency(productsFunctionStack)