import { memoFlowNode } from "@/lib/canvas/memo-flow-node";

import { AiEngineNode } from "./nodes/ai-engine-node";
import { AiVideoEngineNode } from "./nodes/ai-video-engine-node";
import { AudioPreviewNode } from "./nodes/audio-preview-node";
import { GroupNode } from "./nodes/group-node";
import { ImageEngineNode } from "./nodes/image-engine-node";
import { ImageNode } from "./nodes/image-node";
import { ImagePreviewNode } from "./nodes/image-preview-node";
import { JianyingExportNode } from "./nodes/jianying-export-node";
import { JianyingExportProNode } from "./nodes/jianying-export-pro-node";
import { MdPreviewNode } from "./nodes/md-preview-node";
import { OutputNode } from "./nodes/output-node";
import { RefImageGridNode } from "./nodes/ref-image-grid-node";
import {
  CharacterEngineNode,
  StoryboardEngineNode,
  StoryOutlineEngineNode,
} from "./nodes/story-engine-node";
import { StoryCharacterColumnNode } from "./nodes/story-character-column-node";
import { StoryComicStarterNode } from "./nodes/story-comic-starter-node";
import { StoryFrameColumnNode } from "./nodes/story-frame-column-node";
import { StoryProSceneColumnNode } from "./nodes/story-pro-scene-column-node";
import { StoryProScriptHubNode } from "./nodes/story-pro-script-hub-node";
import { StoryPro2StarterNode } from "./pro2/story-pro2-starter-node";
import { StoryPro2ImageNode } from "./pro2/story-pro2-image-node";
import { StoryPro2PlaceholderMediaNode } from "./pro2/story-pro2-placeholder-media-node";
import { StoryPro2ThreeViewNode } from "./pro2/story-pro2-three-view-node";
import { StoryPro2StyleAssetNode } from "./pro2/story-pro2-style-asset-node";
import { StoryPro2ScriptHubNode } from "./pro2/story-pro2-script-hub-node";
import { StoryPro2CharacterBoardNode } from "./pro2/story-pro2-character-board-node";
import { StoryPro2FrameBoardNode } from "./pro2/story-pro2-frame-board-node";
import { JianyingExportPro2Node } from "./pro2/jianying-export-pro2-node";
import {
  Pro2ColumnThinNode,
  StoryPro2ScriptHubThinNode,
  StoryPro2StyleThinNode,
} from "./pro2/pro2-thin-nodes";
import { StoryProStarterNode } from "./nodes/story-pro-starter-node";
import { StoryProStyleNode } from "./nodes/story-pro-style-node";
import { StoryScriptHubNode } from "./nodes/story-script-hub-node";
import { StoryVideoColumnNode } from "./nodes/story-video-column-node";
import { TextNode } from "./nodes/text-node";
import { ThreeViewEngineNode } from "./nodes/three-view-engine-node";
import { TtsEngineNode } from "./nodes/tts-engine-node";
import { VideoEngineNode } from "./nodes/video-engine-node";
import { Sbv1ImageNode } from "./sbv1/sbv1-image-node";
import { Sbv1VideoEngineNode } from "./sbv1/sbv1-video-engine-node";
import { VideoGenerateNode } from "./nodes/video-generate-node";
import { VideoPreviewNode } from "./nodes/video-preview-node";

export const memoizedNodeTypes = {
  image: memoFlowNode(ImageNode),
  text: memoFlowNode(TextNode),
  "story-comic-starter": memoFlowNode(StoryComicStarterNode),
  "ai-engine": memoFlowNode(AiEngineNode),
  "image-engine": memoFlowNode(ImageEngineNode),
  "three-view-engine": memoFlowNode(ThreeViewEngineNode),
  "story-script-hub": memoFlowNode(StoryScriptHubNode),
  "story-character-column": memoFlowNode(StoryCharacterColumnNode),
  "story-frame-column": memoFlowNode(StoryFrameColumnNode),
  "story-video-column": memoFlowNode(StoryVideoColumnNode),
  "video-engine": memoFlowNode(VideoEngineNode),
  "ref-grid-4": memoFlowNode(RefImageGridNode),
  "ref-grid-6": memoFlowNode(RefImageGridNode),
  "ref-grid-9": memoFlowNode(RefImageGridNode),
  "ai-video-engine": memoFlowNode(AiVideoEngineNode),
  "video-generate": memoFlowNode(VideoGenerateNode),
  "tts-engine": memoFlowNode(TtsEngineNode),
  "md-preview": memoFlowNode(MdPreviewNode),
  "audio-preview": memoFlowNode(AudioPreviewNode),
  "video-preview": memoFlowNode(VideoPreviewNode),
  "image-preview": memoFlowNode(ImagePreviewNode),
  "jianying-export": memoFlowNode(JianyingExportNode),
  "story-pro2-starter": memoFlowNode(StoryPro2StarterNode),
  "story-pro2-image": memoFlowNode(StoryPro2ImageNode),
  "story-pro2-three-view": memoFlowNode(StoryPro2ThreeViewNode),
  "story-pro2-style-asset": memoFlowNode(StoryPro2StyleAssetNode),
  "story-pro2-script-hub": memoFlowNode(StoryPro2ScriptHubNode),
  "story-pro2-style": memoFlowNode(StoryPro2StyleThinNode),
  "story-pro2-character": memoFlowNode(StoryPro2CharacterBoardNode),
  "story-pro2-scene": memoFlowNode(Pro2ColumnThinNode),
  "story-pro2-frame": memoFlowNode(StoryPro2FrameBoardNode),
  "story-pro2-video": memoFlowNode(Pro2ColumnThinNode),
  "story-pro2-prop": memoFlowNode(StoryPro2PlaceholderMediaNode),
  "story-pro2-mood": memoFlowNode(StoryPro2PlaceholderMediaNode),
  "story-pro2-audio": memoFlowNode(StoryPro2PlaceholderMediaNode),
  "jianying-export-pro2": memoFlowNode(JianyingExportPro2Node),
  "story-pro-starter": memoFlowNode(StoryProStarterNode),
  "story-pro-script-hub": memoFlowNode(StoryProScriptHubNode),
  "story-pro-style": memoFlowNode(StoryProStyleNode),
  "story-pro-scene": memoFlowNode(StoryProSceneColumnNode),
  "story-pro-character": memoFlowNode(StoryCharacterColumnNode),
  "story-pro-frame": memoFlowNode(StoryFrameColumnNode),
  "story-pro-video": memoFlowNode(StoryVideoColumnNode),
  "jianying-export-pro": memoFlowNode(JianyingExportProNode),
  "sbv1-image": memoFlowNode(Sbv1ImageNode),
  "sbv1-video-engine": memoFlowNode(Sbv1VideoEngineNode),
  output: memoFlowNode(OutputNode),
  group: memoFlowNode(GroupNode),
  "story-outline-engine": memoFlowNode(StoryOutlineEngineNode),
  "character-engine": memoFlowNode(CharacterEngineNode),
  "storyboard-engine": memoFlowNode(StoryboardEngineNode),
};
