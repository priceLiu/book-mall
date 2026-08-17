/**
 * 测试腾讯云短信发送
 * 用法: npx tsx scripts/test-sms.ts <手机号> [模板ID]
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const phone = process.argv[2] || "13808816802";
  const templateId =
    process.argv[3] || process.env.TENCENT_SMS_TEMPLATE_REGISTER || "2705693";

  const secretId = process.env.TENCENT_SMS_SECRET_ID!;
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY!;
  const region = process.env.TENCENT_SMS_REGION || "ap-guangzhou";
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID!;
  const signName = process.env.TENCENT_SMS_SIGN_NAME!;

  console.log("=== 腾讯云短信测试 ===");
  console.log("手机号:", phone);
  console.log("签名:", signName);
  console.log("SDKAppId:", sdkAppId);
  console.log("模板ID:", templateId);
  console.log("Region:", region);
  console.log("");

  const tencentcloud = await import("tencentcloud-sdk-nodejs");
  const SmsClient = tencentcloud.sms.v20210111.Client;
  const client = new SmsClient({
    credential: { secretId, secretKey },
    region,
    profile: { httpProfile: { endpoint: "sms.tencentcloudapi.com" } },
  });

  try {
    const resp = await client.SendSms({
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId: sdkAppId,
      SignName: signName,
      TemplateId: templateId,
      TemplateParamSet: ["123456"],
    });

    console.log("=== API 响应 ===");
    console.log(JSON.stringify(resp, null, 2));

    const status = resp.SendStatusSet?.[0];
    if (status) {
      console.log("");
      console.log("=== 发送状态 ===");
      console.log("Code:", status.Code);
      console.log("Message:", status.Message);
      console.log("IsoCountryCode:", status.IsoCountryCode);
      console.log("PhoneNumber:", status.PhoneNumber);
      console.log("SerialNo:", status.SerialNo);
      console.log("Fee:", status.Fee);
      console.log("SessionContext:", status.SessionContext);
    }
  } catch (e) {
    console.error("=== API 调用异常 ===");
    console.error(e);
  }
}

main();
