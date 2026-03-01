import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useSubmit, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  TextField,
  Banner,
  FormLayout,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const authorization = formData.get("authorization") as string;
  const apiKey = formData.get("apiKey") as string;

  if (!authorization || !apiKey) {
    return json({ error: "Both Authorization and API Key are required." }, { status: 400 });
  }

  try {
    // Step 1: Get the real App Installation GID
    const installationRes = await admin.graphql(
      `#graphql
      query GetAppInstallation {
        currentAppInstallation {
          id
        }
      }`
    );
    const installationData = await installationRes.json();
    const appInstallationId = installationData.data?.currentAppInstallation?.id;

    if (!appInstallationId) {
      console.error("Could not fetch app installation ID", installationData);

      return json({ error: "Failed to save configuration." }, { status: 500 });
    }

    // Step 2: Save metafields using the real installation ID
    const response = await admin.graphql(
      `#graphql
      mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafieldsSetInput) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafieldsSetInput: [
            {
              namespace: "nutaan_chatbot",
              key: "authorization",
              type: "single_line_text_field",
              value: authorization,
              ownerId: appInstallationId,
            },
            {
              namespace: "nutaan_chatbot",
              key: "api_key",
              type: "single_line_text_field",
              value: apiKey,
              ownerId: appInstallationId,
            },
          ],
        },
      }
    );

    const result = await response.json();

    if (result.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Metafield saving errors", result.data.metafieldsSet.userErrors);

      return json({ error: "Failed to save configuration." }, { status: 500 });
    }

    return json({ success: true, message: "Widget configuration saved successfully!" });
  } catch (error) {
    console.error("Metafield error:", error);

    return json({ error: "Failed to save configuration." }, { status: 500 });
  }
};

export default function Index() {
  const shopify = useAppBridge();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [scriptTag, setScriptTag] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [apiKey, setApiKey] = useState("");

  const isLoading = navigation.state === "submitting";

  useEffect(() => {
    if (actionData && "success" in actionData && actionData.success) {
      shopify.toast.show((actionData as any).message || "Saved successfully");
    } else if (actionData && "error" in actionData && actionData.error) {
      shopify.toast.show((actionData as any).error, { isError: true });
    }
  }, [actionData, shopify]);

  const handleScriptTagChange = useCallback((value: string) => {
    setScriptTag(value);
    
    // Parse the script tag string for Authorization and x-api-key attributes
    // Example: <script src="..." Authorization="Bearer nutaan-..." x-api-key="nut-..."></script>
    
    // Look for Authorization="..."
    const authMatch = value.match(/Authorization=["']([^"']+)["']/i);

    if (authMatch?.[1]) {
      setAuthorization(authMatch[1]);
    }

    // Look for x-api-key="..."
    const apiMatch = value.match(/x-api-key=["']([^"']+)["']/i);

    if (apiMatch?.[1]) {
      setApiKey(apiMatch[1]);
    }
  }, []);

  const handleSave = () => {
    submit(
      { authorization, apiKey },
      { method: "POST" }
    );
  };

  return (
    <Page>
      <TitleBar title="Nutaan Chatbot Widget Configurator" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd">
                  Configure Your Chatbot
                </Text>
                
                <Text variant="bodyMd" as="p">
                  Paste your Nutaan widget installation script below. We will automatically extract your Authorization token and API Key.
                </Text>

                <FormLayout>
                  <TextField
                    label="Paste Script Tag"
                    value={scriptTag}
                    onChange={handleScriptTagChange}
                    multiline={4}
                    autoComplete="off"
                    placeholder={`<script src="https://cdn.nutaan.com/chatbot-widget.js" Authorization="Bearer..." x-api-key="..."></script>`}
                    helpText="Copy the entire <script> tag from your Nutaan dashboard and paste it here."
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd">
                  Extracted Credentials
                </Text>

                <FormLayout>
                  <TextField
                    label="Authorization Token"
                    value={authorization}
                    onChange={setAuthorization}
                    autoComplete="off"
                    placeholder="Bearer nutaan-..."
                  />
                  <TextField
                    label="API Key (x-api-key)"
                    value={apiKey}
                    onChange={setApiKey}
                    autoComplete="off"
                    placeholder="nut-..."
                  />
                  <Button 
                    variant="primary" 
                    onClick={handleSave} 
                    loading={isLoading}
                    disabled={!authorization || !apiKey}
                  >
                    Save Credentials
                  </Button>
                </FormLayout>

                {actionData && "success" in actionData && actionData.success && (
                  <Banner title="Configuration Saved" tone="success">
                    <p>
                      Your credentials have been extracted. To enable the chatbot on your store, 
                      go to your <strong>Online Store {'>'} Themes {'>'} Customize</strong>, open the <strong>App Embeds</strong> tab, 
                      enable <strong>Nutaan Live Chat</strong>, and paste these extracted keys into the App Embed settings if they are not already populated.
                    </p>
                  </Banner>
                )}

              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
