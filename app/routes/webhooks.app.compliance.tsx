import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received compliance webhook: ${topic} for shop: ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
    case "customers/data_request":
      // Payload has shop_id, shop_domain, orders_requested, customer, data_request
      // 1. Fetch requested data
      // 2. Deliver to store owner
      console.log(`Processing customers/data_request for shop ${shop}`);
      break;

    case "CUSTOMERS_REDACT":
    case "customers/redact":
      // Payload has shop_id, shop_domain, customer, orders_to_redact
      // 1. Delete customer data from DB
      console.log(`Processing customers/redact for shop ${shop}`);
      break;

    case "SHOP_REDACT":
    case "shop/redact":
      // Payload has shop_id, shop_domain
      // 1. Delete shop data from DB
      console.log(`Processing shop/redact for shop ${shop}`);
      break;

    default:
      console.log(`Unhandled compliance topic: ${topic}`);

      return new Response("Unhandled topic", { status: 404 });
  }

  // Mandatory: return a 200 HTTP status code to acknowledge receipt
  return new Response("Webhook handled successfully", { status: 200 });
};
