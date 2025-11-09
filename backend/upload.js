import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

async function uploadToS3(buffer, fileName, contentType) {
  const key = `uploads/${uuidv4()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
  return url;
}

function extractS3Key(url) {
  const parts = url.split(".com/");
  return parts.length > 1 ? parts[1] : null;
}

export async function uploadBase64ToS3(base64Data, fileName = "image.jpg") {
  const base64String = base64Data.replace(/^data:image\/\\w+;base64,/, "");
  const buffer = Buffer.from(base64String, "base64");
  let contentType = "image/jpeg";
  if (base64Data.startsWith("data:image/png")) contentType = "image/png";
  else if (base64Data.startsWith("data:image/webp")) contentType = "image/webp";
  else if (base64Data.startsWith("data:image/gif")) contentType = "image/gif";
  const url = await uploadToS3(buffer, fileName, contentType);
  return url;
}

export async function removeImageFromS3(imageUrl) {
  if (!imageUrl || !imageUrl.includes("amazonaws.com")) return;
  const key = extractS3Key(imageUrl);
  if (!key) return;
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  await s3Client.send(command);
}

