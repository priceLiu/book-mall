# Video API Quickstart

Before we proceed, you need to create an [API key](https://account.topazlabs.com/manage-api).

This key will be used to authenticate your requests to the Topaz Labs API.

<details>

<summary>How do I get my API key?</summary>

In order to get access to the API, you'll need to [log into](http://topazlabs.com/account) your Topaz Labs account and create your unique API key. If you don't have an account, please follow the link [here](https://topazlabs.com/wp-login.php?action=register) to register.

<figure><img src="/files/v5A92VRBSVpzudLAXLeV" alt=""><figcaption></figcaption></figure>

1. Log into your Topaz Labs account from our [website](https://topazlabs.com/my-account/)
2. Navigate to the **API Keys** section in your account portal, enter a name, and click **Create**
3. Copy your API key (displayed at the top of the screen) and store it in a safe place

{% hint style="warning" %}
You may only view your API key on creation, so please be sure to copy the key as it will no longer be visible to you once you exit the page. If you lose your key, you may log into your account portal to manage your existing keys and generate new ones.
{% endhint %}

</details>

Now, proceed with the below steps.

{% stepper %}
{% step %}

### Create Video Request

Create a video request—just include some details about the source video, output parameters, and desired enhancements.

{% hint style="info" %}
Visit out [API Reference](https://developer.topazlabs.com/api-reference) page for up-to-date functionality. This endpoint is free to use.
{% endhint %}

```c
curl --request POST \
     --url https://api.topazlabs.com/video/ \
     --header 'X-API-Key: Your-API-Key' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '
     {
          "source": {
               "resolution": {
                    "width": 800,
                    "height": 448
               },
               "container": "mp4",
               "size": 477010,
               "duration": 4,
               "frameRate": 24,
               "frameCount": 97
          },
          "output": {
               "resolution": {
                    "width": 800,
                    "height": 448
               },
               "audioCodec": "AAC",
               "audioTransfer": "Copy",
               "frameRate": 24,
               "dynamicCompressionLevel": "High",
               "container": "mp4"
          },
          "filters": [ {
               "model": "apo-8",
               "slowmo": 1,
               "fps": 60,
               "duplicate": true,
               "duplicateThreshold": 0.1
               } ]
     }'
```

{% endstep %}

{% step %}

### Accept & Upload Video Request

After submitting the video request, you can choose to continue by calling this endpoint.

```c
curl --request PATCH \
     --url https://api.topazlabs.com/video/[your-requestID]/accept \
     --header 'X-API-Key: Your-API-Key' \
     --header 'accept: application/json'
```

Once this endpoint is called, you will receive a set of URL(s). You may use the following code snippet to upload the video to that link from your local device.

{% hint style="info" %}
In this example, we will upload the entire video file to a single URL due to its small file size.
{% endhint %}

```c
S3_UPLOAD_URL=[https://...]

curl --verbose --request PUT \
     --upload-file "Your-Video-File" \
     --header "Content-Type: video/mp4" \
     "$S3_UPLOAD_URL"
```

Once uploaded, you'll receive some information about your upload, including your *eTag* number. This will be useful for the next step.
{% endstep %}

{% step %}

### Complete Video Upload

After you have finished uploading your video segments, you may use the following request to confirm that all of your video segments have been received. Once this endpoint is called, you video will begin processing with its enhancements.

```c
curl --request PATCH \
     --url https://api.topazlabs.com/video/[your-requestID]/complete-upload \
     --header 'X-API-Key: Your-API-Key' \
     --header 'accept: application/json' \
     --header 'content-type: application/json' \
     --data '{
       "uploadResults": [
         {
           "partNum": 1,
           "eTag": "your-eTag"
         }
       ]
     }'
```

You should receive a response confirming that your request is queued for processing once you have called the endpoint.
{% endstep %}

{% step %}

### Get Video Status

You may use the following request to view the status of your video request

```c
curl --request GET \
     --url https://api.topazlabs.com/video/[your-requestID]/status \
     --header 'X-API-Key: Your-API-Key' \
     --header 'accept: application/json'
```

Once your video has finished processing, you will receive a link to download your video as a response to this endpoint.
{% endstep %}
{% endstepper %}

Congratulations! You have just completed your first Video API request! 🎉

We have now made popular video models such as Proteus, Starlight Precise, and Astra Creative more available as ready-to-use APIs so that you can easily integrate them into your applications.

<table data-card-size="large" data-view="cards"><thead><tr><th align="center"></th><th data-hidden data-card-cover data-type="image">Cover image</th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td align="center">Proteus<br><code>Precision Video Upscaling</code></td><td><a href="/files/MGibasuJtWp1C6I2erc1">/files/MGibasuJtWp1C6I2erc1</a></td><td><a href="/pages/S3PS8lsDXyUoyG7azmer">/pages/S3PS8lsDXyUoyG7azmer</a></td></tr><tr><td align="center">Starlight Precise 2<br><code>Generative Video Upscaling</code></td><td><a href="/files/HvwdNoTx8LEISVgc2p8q">/files/HvwdNoTx8LEISVgc2p8q</a></td><td><a href="/pages/aL31hOSUmaDJyjy6MMLU">/pages/aL31hOSUmaDJyjy6MMLU</a></td></tr></tbody></table>

Once you find a model that you want to use in our "Models" tab, you can grab the URL from the model's dedicated page. Individual model pages also provide some important information about the model including use cases and examples of how you can call it.

Check out our [API Playground](https://playground.topazlabs.com/) to tinker with these models and let us know your feedback and questions on our [Discord](https://discord.gg/vBCCwr28ZH).

<details>

<summary>How do I make an API call from the API Playground?</summary>

<figure><img src="/files/SOOBKXbhnxGqXypTYku3" alt=""><figcaption></figcaption></figure>

It's now easier more than ever to create and send your first API request. Once you have a Topaz Labs account and you have created your first API key, navigate over to our [API Playground](https://playground.topazlabs.com/) to better understand how to build requests. Please see the walkthrough above for an example of an image being upscaled with our Enhance Synchronous endpoint on the Image API.

</details>

### More Information

<details>

<summary>API Restrictions</summary>

* The API has access rate limits depending on the current load on the servers. If you receive a HTTP 429 response, please try again (soon). We recommend using an exponential backoff for the requests to avoid immediately hitting the limit again.
* The API only responds to HTTPS-secured communications. Any requests sent via HTTP return an HTTP 301 redirect to the corresponding HTTPS resources.
* The API enforces a request size limit of 500MB. If a request exceeds this limit, the server responds with an HTTP 413. Please ensure that requests stay within the size constraint to avoid this error.

</details>

Please reach out to <help@topazlabs.com> with any questions.
