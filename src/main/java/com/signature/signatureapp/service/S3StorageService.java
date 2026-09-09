package com.signature.signatureapp.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;

/**
 * Replaces the local `uploads/` folder, which was ephemeral on Render's
 * free tier - any file written there was lost the moment the instance
 * restarted or spun down after 15 minutes idle (confirmed by reproducing
 * it: the DB row survived, the PDF content didn't).
 *
 * Credentials come from the default AWS credential chain (env vars
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION), never
 * hardcoded here.
 */
@Service
public class S3StorageService {

    private final S3Client s3Client;
    private final String bucketName;

    public S3StorageService(@Value("${aws.s3.bucket}") String bucketName,
                             @Value("${aws.region}") String region) {
        this.bucketName = bucketName;
        this.s3Client = S3Client.builder()
                .region(Region.of(region))
                .build();
    }

    /** Uploads the file under the given key and returns that key. */
    public String upload(MultipartFile file, String key) throws IOException {
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .contentType(file.getContentType())
                        .build(),
                RequestBody.fromInputStream(file.getInputStream(), file.getSize())
        );
        return key;
    }

    /** Downloads the full object into memory. Fine here since these are single PDFs, not large files. */
    public byte[] download(String key) {
        ResponseBytes<GetObjectResponse> object = s3Client.getObjectAsBytes(
                GetObjectRequest.builder().bucket(bucketName).key(key).build()
        );
        return object.asByteArray();
    }

    public void delete(String key) {
        s3Client.deleteObject(
                DeleteObjectRequest.builder().bucket(bucketName).key(key).build()
        );
    }
}
