AI试衣图片分割模型是AI试衣的辅助模型，可对模特图、服饰图进行分割，用于AI试衣图片的前后处理。该模型不是AI试衣的必选项，但将该模型与AI试衣模型搭配使用，可实现一些特定的试衣效果。

模型概览


模型名

模型简介

aitryon-parsing-v1

aitryon-parsing-v1是一个图片处理模型，可对模特图、服饰图进行分割，用于AI试衣图片的前后处理。

模型用途与效果示例
用途一：使用图片分割API做试衣图片的前置处理
如果希望在试衣时，只替换模特图片中的上装/下装，并保留原模特图中的下装/上装区域，可使用图片分割API对试衣图片做前置处理。

例如，希望保留模特图中的上装，仅替换下装。可调用分割接口并选择“upper”，将出参得到的crop_img作为服饰上装图片，与要试衣的下装服饰图一起传入aitryon模型接口。传入aitryon模型的模特图，仍使用模特图的原图；

在该案例中，接口调用顺序为：

（1）试衣图片分割。调用本文档的“AI试衣图片分割API”，输入模特图片，获得所需区域的分割图片。



输入：模特图

输出：crop_img_url

1

入参"clothes_type": ["upper"]

3

作为入参传入aitryon模型

（2）试衣图片生成。调用“AI试衣API”，输入模特图、服饰上装图（由分割获得）、服饰下装图，获得最终的试衣效果图。





输入：模特图

输入：服饰上装图

输入：服饰下装图

输出：试衣效果图

1

上传与输入图片分割API一致的模特图

3

上传图片分割模型的出参：crop_img_url

2

上传需替换的服饰图

5

用途二：使用图片分割API做试衣图片的后置处理
如果希望在试衣时，获取试衣后的服饰区域坐标范围，可使用图片分割API对试衣结果图片做后处理。

指定要获取的上装/下装区域，可获取图中对应的服饰区域bbox。bbox的坐标范围对应parsing_img_url的可视区域，bbox定义为[x1,y1,x2,y2]，以输入原图的左上角为坐标原点，对应左上和右下两个点的坐标。

例如，希望获取试衣结果图的上装区域的坐标范围，以供业务前端添加商品标签或交互热区。可将试衣生成的结果图输入分割接口并选择“upper”，出参得到bbox即为上装在该图片中的坐标范围，出参的parsing_img_url的为该区域的可视化效果。

在该案例中，接口调用顺序为：

（1）试衣图片生成。调用“AI试衣API”，获得试衣效果图；

（2）试衣图片分割。调用本文档的“AI试衣图片分割API”，输入试衣效果图，获得所需区域的bbox。



输入：模特图

输出：parsing_img_url

1

入参"clothes_type": ["upper"]

4

出参中parsing_img_url为指定服饰区域分割后的可视化效果

出参中bbox坐标范围即对应当前可视区域

HTTP调用接口
功能描述
用于试衣图片的分割处理。

前提条件
已开通百炼服务并获得API-KEY：获取API Key。

作业提交接口
 
POST https://dashscope.aliyuncs.com/api/v1/services/vision/image-process/process
入参描述






字段

类型

传参方式

必选

描述

示例值

Content-Type

String

Header

是

请求类型：application/json

application/json

Authorization

String

Header

是

API-Key，例如：Bearer d1**2a

Bearer d1**2a

model

String

Body

是

指明需要调用的模型，此处用aitryon-parsing-v1

aitryon-parsing-v1

input.image_url

String

Body

是

用户上传的待分割图片URL。

5KB<图像文件<5M

150<图片边长<4096

格式支持：jpg、png、jpeg、bmp、heic

"image_url": "http://a/a.jpg"

parameters.clothes_type

List[String]

Body

是

希望返回的分割区域，可选["upper"], ["lower"], ["dress"], ["upper", "lower"]。

"upper"代表上身服饰。

"lower"代表下身服饰。

"dress"代表连体服饰或全身穿搭。

list的长度决定返回图片地址数量。

"clothes_type": ["lower"]

出参描述




字段

类型

描述

示例值

output.parsing_img_url

List[String]

返回的保存服饰分割结果URL的list，list长度与parameters.clothes_type的长度一致。对应位置为None/null则表示不存在该种类服饰。

图片通道数为rgba，保存为png格式。

["http://a/a.png"]

[None/null]

output.crop_img_url

List[String]

返回的保存服饰分割crop结果url的list，list长度与parameters.clothes_type的长度一致。对应位置为None/null则表示不存在该种类服饰。

图片通道数为rgb，保存为png格式。

["http://a/a.png"]

[None/null]

output.bbox

List<Integer>

分割区域在原图中位置的bbox列表，按照clothes_type中指定的区域顺序排序。

bbox定义为[x1,y1,x2,y2]，以输入原图的左上角为坐标原点，对应左上和右下两个点的坐标。

"bbox": [[10,20,30,40], [50,60,70,80]]

usage.image_count

Integer

本次请求检测的图片数量，单位：张

"image_count": 1

request_id

String

本次请求的系统唯一码

7574ee8f-38a3-4b1e-9280-11c33ab46e51

请求示例：
 
curl --location 'https://dashscope.aliyuncs.com/api/v1/services/vision/image-process/process'\
--header 'Authorization: Bearer <YOUR_API_KEY>' \
--header 'Content-Type: application/json' \
--data '{
  "model": "aitryon-parsing-v1",
  "input": {
      "image_url":"http://xxx/1.jpg"
  },
  "parameters": {
      "clothes_type": ["upper", "lower"]
  }
}'
响应示例（存在对应类型服饰）：
 
{
    "output":{
        "parsing_img_url":["http://xxx/1.png","http://xxx/2.png"],
        "crop_img_url":["http://xxx/3.png","http://xxx/4.png"],
        "bbox":[[10,20,30,40],[50,60,70,80]]
    },
    "usage":{
        "image_count":1
    },
    "request_id":"c56f62df-724e-9c19-96bd-308627cf5262"
}
响应示例（不存在对应类型服饰）：
 
{
    "output":{
        "parsing_img_url":[null],
        "crop_img_url":[null],
        "bbox":[null]
    },
    "usage":{
        "image_count":1
    },
    "request_id":"c56f62df-724e-9c19-96bd-308627cf5262"
}
响应示例（错误）：
 
{
    "output":{
        "code":xxxx,
        "message":xxxx,
    },
    "request_id":"c56f62df-724e-9c19-96bd-308627cf5262"
}
状态码说明
大模型服务平台通用状态码请查阅：错误信息。

同时本模型还有如下特定错误码：





http 返回码*

错误码（code）

错误信息（message）

含义说明

400

InvalidParameter

The request is missing required parameters or in a wrong format, please check the parameters that you send.

入参格式不对

400

InvalidParameter.ClothesType

The request parameter is invalid, please check the request parameter.

ClothesType入参不合规

400

InvalidURL

The request URL is invalid, please check the request URL is available and the request image format is one of the following types: JPEG, JPG, PNG, BMP, and WEBP.

输入图片下载失败，请检查网络或者输入格式

400

InvalidInputLength

The image resolution is invalid, please make sure that the largest length of image is smaller than 4096, and the smallest length of image is larger than 150. and the size of image ranges from 5KB to 5MB

上传图片大小不符合要求


常见问题
如何准备模特图和服饰图
为什么必须使用服装平铺图？

平铺图能最清晰地展示服装的版型、图案和轮廓，帮助AI准确理解服装结构，从而生成更贴合、更真实的试穿效果。

如果没有服装平铺图怎么办？

您可以尝试将服装平整地放置在干净的背景上（如地面或墙面）进行俯拍，或者让真人模特/人台穿着后拍摄正面照。关键是确保服装完整、平整、无遮挡。

如何选择合适的模特图？

选择正面、清晰、完整的全身照。模特穿着的衣物应尽量简洁修身（如T恤+短裤），避免穿着长裙、宽袍大袖或有多层叠穿。同时，确保模特的双手双脚清晰可见，无配饰（如包、伞）遮挡。

如果没有合适的模特图怎么办？

我们提供了一批符合规范的模特参考图，您可以点击此处下载使用。

模型效果不符合预期
为什么生成的图片效果不佳，缺少细节？

主要原因可能是输入的服装图质量不高。请确保服装图高清、完整，没有因折叠或拍摄角度问题导致细节丢失。高质量的输入是高质量输出的保障。

功能使用咨询
如何为连衣裙或连体衣生成试衣图？

将连衣裙/连体衣的图片URL填入input.top_garment_url字段，并将input.bottom_garment_url字段留空或不传。

计费与限流