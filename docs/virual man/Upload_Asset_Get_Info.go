package main

import (
    "errors"
    "fmt"
    "time"

    "github.com/bytedance/sonic"
    "github.com/volcengine/volcengine-go-sdk/volcengine"
    "github.com/volcengine/volcengine-go-sdk/volcengine/credentials"
    "github.com/volcengine/volcengine-go-sdk/volcengine/session"
    "github.com/volcengine/volcengine-go-sdk/volcengine/universal"
)

const (
    region      = "cn-beijing"
    serviceName = "ark"
    version     = "2024-01-01"

    // 轮询配置
    pollInterval = 3 * time.Second
    pollTimeout  = 60 * time.Minute
)

func main() {
    // TODO: 替换为你的 AK / SK
    ak := "<YOUR_AK>"
    sk := "<YOUR_SK>"

    // TODO: 替换为你的实际参数
    groupID := "group-20260318033332-*****"
    assetURL := "<IMAGE_URL>"
    assetType := "Image"
    projectName := "default"

    config := volcengine.NewConfig().
        WithCredentials(credentials.NewStaticCredentials(ak, sk, "")).
        WithRegion(region)

    sess, err := session.NewSession(config)
    if err != nil {
        fmt.Printf("create session failed: %v\n", err)
        return
    }

    client := universal.New(sess)

    // 1. 创建资产
    assetID, err := createAsset(client, groupID, assetURL, assetType, projectName)
    if err != nil {
        fmt.Printf("create asset failed: %v\n", err)
        return
    }

    fmt.Printf("asset created, AssetId = %s\n", assetID)

    // 2. 查询资产状态
    finalURL, err := waitForAssetActive(client, assetID, pollInterval, pollTimeout)
    if err != nil {
        fmt.Printf("poll asset failed: %v\n", err)
        return
    }

    fmt.Printf("asset is active, URL = %s\n", finalURL)
}

// createAsset 调用 CreateAsset 并返回 AssetId
func createAsset(client *universal.Universal, groupID, url, assetType, projectName string) (string, error) {
    resp, err := client.DoCall(
        universal.RequestUniversal{
            ServiceName: serviceName,
            Action:      "CreateAsset",
            Version:     version,
            HttpMethod:  universal.POST,
            ContentType: universal.ApplicationJSON,
        },
        &map[string]any{
            "GroupId":     groupID,
            "URL":         url,
            "AssetType":   assetType,
            "ProjectName": projectName,
        },
    )
    if err != nil {
        return "", err
    }
    if resp == nil {
        return "", errors.New("create asset response is nil")
    }

    // 打印原始返回，便于排查
    respData, _ := sonic.Marshal(resp)
    fmt.Printf("CreateAsset response: %s\n", string(respData))

    assetID := extractString(resp, "Result", "Id")
    if assetID == "" {
        assetID = extractString(resp, "Result", "AssetId")
    }
    if assetID == "" {
        assetID = extractString(resp, "Id")
    }
    if assetID == "" {
        assetID = extractString(resp, "AssetId")
    }

    if assetID == "" {
        return "", fmt.Errorf("cannot find AssetId in response: %s", string(respData))
    }

    return assetID, nil
}

// waitForAssetActive 查询 GetAsset，直到 Active / Failed / 超时
func waitForAssetActive(client *universal.Universal, assetID string, interval, timeout time.Duration) (string, error) {
    deadline := time.Now().Add(timeout)

    for {
        if time.Now().After(deadline) {
            return "", fmt.Errorf("polling timeout after %v, assetID=%s", timeout, assetID)
        }

        status, url, errMsg, err := getAssetStatus(client, assetID)
        if err != nil {
            return "", err
        }

        fmt.Printf("asset status: %s\n", status)

        switch status {
        case "Processing":
            time.Sleep(interval)
            continue
        case "Active":
            if url == "" {
                return "", fmt.Errorf("asset is Active but URL is empty, assetID=%s", assetID)
            }
            return url, nil
        case "Failed":
            if errMsg == "" {
                errMsg = "unknown asset processing error"
            }
            return "", fmt.Errorf("asset processing failed: %s", errMsg)
        default:
            // 若返回其他状态，保守处理为继续查询
            fmt.Printf("unexpected status %q, continue polling...\n", status)
            time.Sleep(interval)
        }
    }
}

// getAssetStatus 调用 GetAsset，返回 Status / URL / Error
func getAssetStatus(client *universal.Universal, assetID string) (status, url, errMsg string, err error) {
    resp, err := client.DoCall(
        universal.RequestUniversal{
            ServiceName: serviceName,
            Action:      "GetAsset",
            Version:     version,
            HttpMethod:  universal.POST,
            ContentType: universal.ApplicationJSON,
        },
        &map[string]any{
            "Id": assetID,
        },
    )
    if err != nil {
        return "", "", "", err
    }
    if resp == nil {
        return "", "", "", errors.New("get asset response is nil")
    }

    // 打印原始返回，便于排查
    respData, _ := sonic.Marshal(resp)
    fmt.Printf("GetAsset response: %s\n", string(respData))

    // 兼容不同层级的字段位置
    status = extractString(resp, "Result", "Status")
    if status == "" {
        status = extractString(resp, "Status")
    }

    url = extractString(resp, "Result", "URL")
    if url == "" {
        url = extractString(resp, "URL")
    }

    errMsg = extractString(resp, "Result", "Error")
    if errMsg == "" {
        errMsg = extractString(resp, "Error")
    }

    return status, url, errMsg, nil
}

// extractString 从响应中按层级安全提取字符串
func extractString(data any, keys ...string) string {
    current := data

    for _, key := range keys {
        switch v := current.(type) {
        case map[string]any:
            next, ok := v[key]
            if !ok {
                return ""
            }
            current = next

        case *map[string]any:
            if v == nil {
                return ""
            }
            next, ok := (*v)[key]
            if !ok {
                return ""
            }
            current = next

        default:
            return ""
        }
    }

    switch v := current.(type) {
    case string:
        return v
    case fmt.Stringer:
        return v.String()
    case nil:
        return ""
    default:
        return fmt.Sprintf("%v", v)
    }
}