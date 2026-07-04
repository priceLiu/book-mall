api-key: sk-api-fLyS6Hr535NUVMgHop3ZHLSeaTZcZSlD_A4px7roYcjxKGRV6fCcWWK_oQd_WRLWDZcF9E8se8j34I4KUgk-50MshuRitsEqghmXxjwbYtA2BVfkntpeQwY

> 运维：`book-mall` 下 `pnpm qr:bind-minimax-gateway` 从上行 `api-key:` 写入 Gateway 凭证池并绑定管理员 `sk-gw`（Book **不直连** MiniMax，只走 Gateway）。

## Gateway modelKey（QuickReplica / Gateway 路由）

| modelKey | 用途 |
|----------|------|
| `MiniMax/speech-2.8-hd` | 旁白 TTS / 音色快速复刻试听（默认） |
| `MiniMax/speech-2.8-turbo` | 低延迟 TTS / 音色快速复刻试听 |
| `MiniMax/speech-2.6-hd` | Speech 2.6 HD · 情感控制 |
| `MiniMax/speech-2.6-turbo` | Speech 2.6 Turbo · 情感控制 |
| `MiniMax/speech-02-hd` | Speech 02 HD |
| `MiniMax/speech-02-turbo` | Speech 02 Turbo |
| `MiniMax/music-1.5` | 音乐生成 |

Gateway HTTP：`POST /api/gw/v1/minimax/tts`、`/voices/query`、`/voice-convert`、`/voice-clone`、`/files/upload`、`/music/generate` 等。

音色 OSS manifest：`content/quick-replica/minimax-voice-catalog.json`；同步命令 `pnpm qr:sync-minimax-voices`（见 `docs/dev.md`）。

文档：https://platform.minimaxi.com/docs/api-reference/voice-management-get


> ## Documentation Index
> Fetch the complete documentation index at: https://platform.minimaxi.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 系统音色列表

> 本文档列举了MiniMax开放平台全部的系统音色，为您提供语音合成选择。参考以下表格的内容，可查阅目前全部的系统音色的ID(Voice ID)、名称及支持语言，方便开发者快速查询与调用。

参考以下表格的内容，可查阅目前全部的系统音色。

| 序号  | 语言       | 音色 ID (Voice ID)                            | 音色名称 (Voice Name)         |
| :-- | :------- | :------------------------------------------ | :------------------------ |
| 1   | 中文 (普通话) | `male-qn-qingse`                            | 青涩青年音色                    |
| 2   | 中文 (普通话) | `male-qn-jingying`                          | 精英青年音色                    |
| 3   | 中文 (普通话) | `male-qn-badao`                             | 霸道青年音色                    |
| 4   | 中文 (普通话) | `male-qn-daxuesheng`                        | 青年大学生音色                   |
| 5   | 中文 (普通话) | `female-shaonv`                             | 少女音色                      |
| 6   | 中文 (普通话) | `female-yujie`                              | 御姐音色                      |
| 7   | 中文 (普通话) | `female-chengshu`                           | 成熟女性音色                    |
| 8   | 中文 (普通话) | `female-tianmei`                            | 甜美女性音色                    |
| 9   | 中文 (普通话) | `male-qn-qingse-jingpin`                    | 青涩青年音色-beta               |
| 10  | 中文 (普通话) | `male-qn-jingying-jingpin`                  | 精英青年音色-beta               |
| 11  | 中文 (普通话) | `male-qn-badao-jingpin`                     | 霸道青年音色-beta               |
| 12  | 中文 (普通话) | `male-qn-daxuesheng-jingpin`                | 青年大学生音色-beta              |
| 13  | 中文 (普通话) | `female-shaonv-jingpin`                     | 少女音色-beta                 |
| 14  | 中文 (普通话) | `female-yujie-jingpin`                      | 御姐音色-beta                 |
| 15  | 中文 (普通话) | `female-chengshu-jingpin`                   | 成熟女性音色-beta               |
| 16  | 中文 (普通话) | `female-tianmei-jingpin`                    | 甜美女性音色-beta               |
| 17  | 中文 (普通话) | `clever_boy`                                | 聪明男童                      |
| 18  | 中文 (普通话) | `cute_boy`                                  | 可爱男童                      |
| 19  | 中文 (普通话) | `lovely_girl`                               | 萌萌女童                      |
| 20  | 中文 (普通话) | `cartoon_pig`                               | 卡通猪小琪                     |
| 21  | 中文 (普通话) | `bingjiao_didi`                             | 病娇弟弟                      |
| 22  | 中文 (普通话) | `junlang_nanyou`                            | 俊朗男友                      |
| 23  | 中文 (普通话) | `chunzhen_xuedi`                            | 纯真学弟                      |
| 24  | 中文 (普通话) | `lengdan_xiongzhang`                        | 冷淡学长                      |
| 25  | 中文 (普通话) | `badao_shaoye`                              | 霸道少爷                      |
| 26  | 中文 (普通话) | `tianxin_xiaoling`                          | 甜心小玲                      |
| 27  | 中文 (普通话) | `qiaopi_mengmei`                            | 俏皮萌妹                      |
| 28  | 中文 (普通话) | `wumei_yujie`                               | 妩媚御姐                      |
| 29  | 中文 (普通话) | `diadia_xuemei`                             | 嗲嗲学妹                      |
| 30  | 中文 (普通话) | `danya_xuejie`                              | 淡雅学姐                      |
| 31  | 中文 (普通话) | `Chinese (Mandarin)_Reliable_Executive`     | 沉稳高管                      |
| 32  | 中文 (普通话) | `Chinese (Mandarin)_News_Anchor`            | 新闻女声                      |
| 33  | 中文 (普通话) | `Chinese (Mandarin)_Mature_Woman`           | 傲娇御姐                      |
| 34  | 中文 (普通话) | `Chinese (Mandarin)_Unrestrained_Young_Man` | 不羁青年                      |
| 35  | 中文 (普通话) | `Arrogant_Miss`                             | 嚣张小姐                      |
| 36  | 中文 (普通话) | `Robot_Armor`                               | 机械战甲                      |
| 37  | 中文 (普通话) | `Chinese (Mandarin)_Kind-hearted_Antie`     | 热心大婶                      |
| 38  | 中文 (普通话) | `Chinese (Mandarin)_HK_Flight_Attendant`    | 港普空姐                      |
| 39  | 中文 (普通话) | `Chinese (Mandarin)_Humorous_Elder`         | 搞笑大爷                      |
| 40  | 中文 (普通话) | `Chinese (Mandarin)_Gentleman`              | 温润男声                      |
| 41  | 中文 (普通话) | `Chinese (Mandarin)_Warm_Bestie`            | 温暖闺蜜                      |
| 42  | 中文 (普通话) | `Chinese (Mandarin)_Male_Announcer`         | 播报男声                      |
| 43  | 中文 (普通话) | `Chinese (Mandarin)_Sweet_Lady`             | 甜美女声                      |
| 44  | 中文 (普通话) | `Chinese (Mandarin)_Southern_Young_Man`     | 南方小哥                      |
| 45  | 中文 (普通话) | `Chinese (Mandarin)_Wise_Women`             | 阅历姐姐                      |
| 46  | 中文 (普通话) | `Chinese (Mandarin)_Gentle_Youth`           | 温润青年                      |
| 47  | 中文 (普通话) | `Chinese (Mandarin)_Warm_Girl`              | 温暖少女                      |
| 48  | 中文 (普通话) | `Chinese (Mandarin)_Kind-hearted_Elder`     | 花甲奶奶                      |
| 49  | 中文 (普通话) | `Chinese (Mandarin)_Cute_Spirit`            | 憨憨萌兽                      |
| 50  | 中文 (普通话) | `Chinese (Mandarin)_Radio_Host`             | 电台男主播                     |
| 51  | 中文 (普通话) | `Chinese (Mandarin)_Lyrical_Voice`          | 抒情男声                      |
| 52  | 中文 (普通话) | `Chinese (Mandarin)_Straightforward_Boy`    | 率真弟弟                      |
| 53  | 中文 (普通话) | `Chinese (Mandarin)_Sincere_Adult`          | 真诚青年                      |
| 54  | 中文 (普通话) | `Chinese (Mandarin)_Gentle_Senior`          | 温柔学姐                      |
| 55  | 中文 (普通话) | `Chinese (Mandarin)_Stubborn_Friend`        | 嘴硬竹马                      |
| 56  | 中文 (普通话) | `Chinese (Mandarin)_Crisp_Girl`             | 清脆少女                      |
| 57  | 中文 (普通话) | `Chinese (Mandarin)_Pure-hearted_Boy`       | 清澈邻家弟弟                    |
| 58  | 中文 (普通话) | `Chinese (Mandarin)_Soft_Girl`              | 柔和少女                      |
| 59  | 中文 (粤语)  | `Cantonese_ProfessionalHost（F)`             | 专业女主持                     |
| 60  | 中文 (粤语)  | `Cantonese_GentleLady`                      | 温柔女声                      |
| 61  | 中文 (粤语)  | `Cantonese_ProfessionalHost（M)`             | 专业男主持                     |
| 62  | 中文 (粤语)  | `Cantonese_PlayfulMan`                      | 活泼男声                      |
| 63  | 中文 (粤语)  | `Cantonese_CuteGirl`                        | 可爱女孩                      |
| 64  | 中文 (粤语)  | `Cantonese_KindWoman`                       | 善良女声                      |
| 65  | 英文       | `Santa_Claus `                              | Santa Claus               |
| 66  | 英文       | `Grinch`                                    | Grinch                    |
| 67  | 英文       | `Rudolph`                                   | Rudolph                   |
| 68  | 英文       | `Arnold`                                    | Arnold                    |
| 69  | 英文       | `Charming_Santa`                            | Charming Santa            |
| 70  | 英文       | `Charming_Lady`                             | Charming Lady             |
| 71  | 英文       | `Sweet_Girl`                                | Sweet Girl                |
| 72  | 英文       | `Cute_Elf`                                  | Cute Elf                  |
| 73  | 英文       | `Attractive_Girl`                           | Attractive Girl           |
| 74  | 英文       | `Serene_Woman`                              | Serene Woman              |
| 75  | 英文       | `English_Trustworthy_Man`                   | Trustworthy Man           |
| 76  | 英文       | `English_Graceful_Lady`                     | Graceful Lady             |
| 77  | 英文       | `English_Aussie_Bloke`                      | Aussie Bloke              |
| 78  | 英文       | `English_Whispering_girl`                   | Whispering girl           |
| 79  | 英文       | `English_Diligent_Man`                      | Diligent Man              |
| 80  | 英文       | `English_Gentle-voiced_man`                 | Gentle-voiced man         |
| 81  | 日文       | `Japanese_IntellectualSenior`               | Intellectual Senior       |
| 82  | 日文       | `Japanese_DecisivePrincess`                 | Decisive Princess         |
| 83  | 日文       | `Japanese_LoyalKnight`                      | Loyal Knight              |
| 84  | 日文       | `Japanese_DominantMan`                      | Dominant Man              |
| 85  | 日文       | `Japanese_SeriousCommander`                 | Serious Commander         |
| 86  | 日文       | `Japanese_ColdQueen`                        | Cold Queen                |
| 87  | 日文       | `Japanese_DependableWoman`                  | Dependable Woman          |
| 88  | 日文       | `Japanese_GentleButler`                     | Gentle Butler             |
| 89  | 日文       | `Japanese_KindLady`                         | Kind Lady                 |
| 90  | 日文       | `Japanese_CalmLady`                         | Calm Lady                 |
| 91  | 日文       | `Japanese_OptimisticYouth`                  | Optimistic Youth          |
| 92  | 日文       | `Japanese_GenerousIzakayaOwner`             | Generous Izakaya Owner    |
| 93  | 日文       | `Japanese_SportyStudent`                    | Sporty Student            |
| 94  | 日文       | `Japanese_InnocentBoy`                      | Innocent Boy              |
| 95  | 日文       | `Japanese_GracefulMaiden`                   | Graceful Maiden           |
| 96  | 韩文       | `Korean_SweetGirl`                          | Sweet Girl                |
| 97  | 韩文       | `Korean_CheerfulBoyfriend`                  | Cheerful Boyfriend        |
| 98  | 韩文       | `Korean_EnchantingSister`                   | Enchanting Sister         |
| 99  | 韩文       | `Korean_ShyGirl`                            | Shy Girl                  |
| 100 | 韩文       | `Korean_ReliableSister`                     | Reliable Sister           |
| 101 | 韩文       | `Korean_StrictBoss`                         | Strict Boss               |
| 102 | 韩文       | `Korean_SassyGirl`                          | Sassy Girl                |
| 103 | 韩文       | `Korean_ChildhoodFriendGirl`                | Childhood Friend Girl     |
| 104 | 韩文       | `Korean_PlayboyCharmer`                     | Playboy Charmer           |
| 105 | 韩文       | `Korean_ElegantPrincess`                    | Elegant Princess          |
| 106 | 韩文       | `Korean_BraveFemaleWarrior`                 | Brave Female Warrior      |
| 107 | 韩文       | `Korean_BraveYouth`                         | Brave Youth               |
| 108 | 韩文       | `Korean_CalmLady`                           | Calm Lady                 |
| 109 | 韩文       | `Korean_EnthusiasticTeen`                   | Enthusiastic Teen         |
| 110 | 韩文       | `Korean_SoothingLady`                       | Soothing Lady             |
| 111 | 韩文       | `Korean_IntellectualSenior`                 | Intellectual Senior       |
| 112 | 韩文       | `Korean_LonelyWarrior`                      | Lonely Warrior            |
| 113 | 韩文       | `Korean_MatureLady`                         | Mature Lady               |
| 114 | 韩文       | `Korean_InnocentBoy`                        | Innocent Boy              |
| 115 | 韩文       | `Korean_CharmingSister`                     | Charming Sister           |
| 116 | 韩文       | `Korean_AthleticStudent`                    | Athletic Student          |
| 117 | 韩文       | `Korean_BraveAdventurer`                    | Brave Adventurer          |
| 118 | 韩文       | `Korean_CalmGentleman`                      | Calm Gentleman            |
| 119 | 韩文       | `Korean_WiseElf`                            | Wise Elf                  |
| 120 | 韩文       | `Korean_CheerfulCoolJunior`                 | Cheerful Cool Junior      |
| 121 | 韩文       | `Korean_DecisiveQueen`                      | Decisive Queen            |
| 122 | 韩文       | `Korean_ColdYoungMan`                       | Cold Young Man            |
| 123 | 韩文       | `Korean_MysteriousGirl`                     | Mysterious Girl           |
| 124 | 韩文       | `Korean_QuirkyGirl`                         | Quirky Girl               |
| 125 | 韩文       | `Korean_ConsiderateSenior`                  | Considerate Senior        |
| 126 | 韩文       | `Korean_CheerfulLittleSister`               | Cheerful Little Sister    |
| 127 | 韩文       | `Korean_DominantMan`                        | Dominant Man              |
| 128 | 韩文       | `Korean_AirheadedGirl`                      | Airheaded Girl            |
| 129 | 韩文       | `Korean_ReliableYouth`                      | Reliable Youth            |
| 130 | 韩文       | `Korean_FriendlyBigSister`                  | Friendly Big Sister       |
| 131 | 韩文       | `Korean_GentleBoss`                         | Gentle Boss               |
| 132 | 韩文       | `Korean_ColdGirl`                           | Cold Girl                 |
| 133 | 韩文       | `Korean_HaughtyLady`                        | Haughty Lady              |
| 134 | 韩文       | `Korean_CharmingElderSister`                | Charming Elder Sister     |
| 135 | 韩文       | `Korean_IntellectualMan`                    | Intellectual Man          |
| 136 | 韩文       | `Korean_CaringWoman`                        | Caring Woman              |
| 137 | 韩文       | `Korean_WiseTeacher`                        | Wise Teacher              |
| 138 | 韩文       | `Korean_ConfidentBoss`                      | Confident Boss            |
| 139 | 韩文       | `Korean_AthleticGirl`                       | Athletic Girl             |
| 140 | 韩文       | `Korean_PossessiveMan`                      | Possessive Man            |
| 141 | 韩文       | `Korean_GentleWoman`                        | Gentle Woman              |
| 142 | 韩文       | `Korean_CockyGuy`                           | Cocky Guy                 |
| 143 | 韩文       | `Korean_ThoughtfulWoman`                    | Thoughtful Woman          |
| 144 | 韩文       | `Korean_OptimisticYouth`                    | Optimistic Youth          |
| 145 | 西班牙文     | `Spanish_SereneWoman`                       | Serene Woman              |
| 146 | 西班牙文     | `Spanish_MaturePartner`                     | Mature Partner            |
| 147 | 西班牙文     | `Spanish_CaptivatingStoryteller`            | Captivating Storyteller   |
| 148 | 西班牙文     | `Spanish_Narrator`                          | Narrator                  |
| 149 | 西班牙文     | `Spanish_WiseScholar`                       | Wise Scholar              |
| 150 | 西班牙文     | `Spanish_Kind-heartedGirl`                  | Kind-hearted Girl         |
| 151 | 西班牙文     | `Spanish_DeterminedManager`                 | Determined Manager        |
| 152 | 西班牙文     | `Spanish_BossyLeader`                       | Bossy Leader              |
| 153 | 西班牙文     | `Spanish_ReservedYoungMan`                  | Reserved Young Man        |
| 154 | 西班牙文     | `Spanish_ConfidentWoman`                    | Confident Woman           |
| 155 | 西班牙文     | `Spanish_ThoughtfulMan`                     | Thoughtful Man            |
| 156 | 西班牙文     | `Spanish_Strong-WilledBoy`                  | Strong-willed Boy         |
| 157 | 西班牙文     | `Spanish_SophisticatedLady`                 | Sophisticated Lady        |
| 158 | 西班牙文     | `Spanish_RationalMan`                       | Rational Man              |
| 159 | 西班牙文     | `Spanish_AnimeCharacter`                    | Anime Character           |
| 160 | 西班牙文     | `Spanish_Deep-tonedMan`                     | Deep-toned Man            |
| 161 | 西班牙文     | `Spanish_Fussyhostess`                      | Fussy hostess             |
| 162 | 西班牙文     | `Spanish_SincereTeen`                       | Sincere Teen              |
| 163 | 西班牙文     | `Spanish_FrankLady`                         | Frank Lady                |
| 164 | 西班牙文     | `Spanish_Comedian`                          | Comedian                  |
| 165 | 西班牙文     | `Spanish_Debator`                           | Debator                   |
| 166 | 西班牙文     | `Spanish_ToughBoss`                         | Tough Boss                |
| 167 | 西班牙文     | `Spanish_Wiselady`                          | Wise Lady                 |
| 168 | 西班牙文     | `Spanish_Steadymentor`                      | Steady Mentor             |
| 169 | 西班牙文     | `Spanish_Jovialman`                         | Jovial Man                |
| 170 | 西班牙文     | `Spanish_SantaClaus`                        | Santa Claus               |
| 171 | 西班牙文     | `Spanish_Rudolph`                           | Rudolph                   |
| 172 | 西班牙文     | `Spanish_Intonategirl`                      | Intonate Girl             |
| 173 | 西班牙文     | `Spanish_Arnold`                            | Arnold                    |
| 174 | 西班牙文     | `Spanish_Ghost`                             | Ghost                     |
| 175 | 西班牙文     | `Spanish_HumorousElder`                     | Humorous Elder            |
| 176 | 西班牙文     | `Spanish_EnergeticBoy`                      | Energetic Boy             |
| 177 | 西班牙文     | `Spanish_WhimsicalGirl`                     | Whimsical Girl            |
| 178 | 西班牙文     | `Spanish_StrictBoss`                        | Strict Boss               |
| 179 | 西班牙文     | `Spanish_ReliableMan`                       | Reliable Man              |
| 180 | 西班牙文     | `Spanish_SereneElder`                       | Serene Elder              |
| 181 | 西班牙文     | `Spanish_AngryMan`                          | Angry Man                 |
| 182 | 西班牙文     | `Spanish_AssertiveQueen`                    | Assertive Queen           |
| 183 | 西班牙文     | `Spanish_CaringGirlfriend`                  | Caring Girlfriend         |
| 184 | 西班牙文     | `Spanish_PowerfulSoldier`                   | Powerful Soldier          |
| 185 | 西班牙文     | `Spanish_PassionateWarrior`                 | Passionate Warrior        |
| 186 | 西班牙文     | `Spanish_ChattyGirl`                        | Chatty Girl               |
| 187 | 西班牙文     | `Spanish_RomanticHusband`                   | Romantic Husband          |
| 188 | 西班牙文     | `Spanish_CompellingGirl`                    | Compelling Girl           |
| 189 | 西班牙文     | `Spanish_PowerfulVeteran`                   | Powerful Veteran          |
| 190 | 西班牙文     | `Spanish_SensibleManager`                   | Sensible Manager          |
| 191 | 西班牙文     | `Spanish_ThoughtfulLady`                    | Thoughtful Lady           |
| 192 | 葡萄牙文     | `Portuguese_SentimentalLady`                | Sentimental Lady          |
| 193 | 葡萄牙文     | `Portuguese_BossyLeader`                    | Bossy Leader              |
| 194 | 葡萄牙文     | `Portuguese_Wiselady`                       | Wise lady                 |
| 195 | 葡萄牙文     | `Portuguese_Strong-WilledBoy`               | Strong-willed Boy         |
| 196 | 葡萄牙文     | `Portuguese_Deep-VoicedGentleman`           | Deep-voiced Gentleman     |
| 197 | 葡萄牙文     | `Portuguese_UpsetGirl`                      | Upset Girl                |
| 198 | 葡萄牙文     | `Portuguese_PassionateWarrior`              | Passionate Warrior        |
| 199 | 葡萄牙文     | `Portuguese_AnimeCharacter`                 | Anime Character           |
| 200 | 葡萄牙文     | `Portuguese_ConfidentWoman`                 | Confident Woman           |
| 201 | 葡萄牙文     | `Portuguese_AngryMan`                       | Angry Man                 |
| 202 | 葡萄牙文     | `Portuguese_CaptivatingStoryteller`         | Captivating Storyteller   |
| 203 | 葡萄牙文     | `Portuguese_Godfather`                      | Godfather                 |
| 204 | 葡萄牙文     | `Portuguese_ReservedYoungMan`               | Reserved Young Man        |
| 205 | 葡萄牙文     | `Portuguese_SmartYoungGirl`                 | Smart Young Girl          |
| 206 | 葡萄牙文     | `Portuguese_Kind-heartedGirl`               | Kind-hearted Girl         |
| 207 | 葡萄牙文     | `Portuguese_Pompouslady`                    | Pompous lady              |
| 208 | 葡萄牙文     | `Portuguese_Grinch`                         | Grinch                    |
| 209 | 葡萄牙文     | `Portuguese_Debator`                        | Debator                   |
| 210 | 葡萄牙文     | `Portuguese_SweetGirl`                      | Sweet Girl                |
| 211 | 葡萄牙文     | `Portuguese_AttractiveGirl`                 | Attractive Girl           |
| 212 | 葡萄牙文     | `Portuguese_ThoughtfulMan`                  | Thoughtful Man            |
| 213 | 葡萄牙文     | `Portuguese_PlayfulGirl`                    | Playful Girl              |
| 214 | 葡萄牙文     | `Portuguese_GorgeousLady`                   | Gorgeous Lady             |
| 215 | 葡萄牙文     | `Portuguese_LovelyLady`                     | Lovely Lady               |
| 216 | 葡萄牙文     | `Portuguese_SereneWoman`                    | Serene Woman              |
| 217 | 葡萄牙文     | `Portuguese_SadTeen`                        | Sad Teen                  |
| 218 | 葡萄牙文     | `Portuguese_MaturePartner`                  | Mature Partner            |
| 219 | 葡萄牙文     | `Portuguese_Comedian`                       | Comedian                  |
| 220 | 葡萄牙文     | `Portuguese_NaughtySchoolgirl`              | Naughty Schoolgirl        |
| 221 | 葡萄牙文     | `Portuguese_Narrator`                       | Narrator                  |
| 222 | 葡萄牙文     | `Portuguese_ToughBoss`                      | Tough Boss                |
| 223 | 葡萄牙文     | `Portuguese_Fussyhostess`                   | Fussy hostess             |
| 224 | 葡萄牙文     | `Portuguese_Dramatist`                      | Dramatist                 |
| 225 | 葡萄牙文     | `Portuguese_Steadymentor`                   | Steady Mentor             |
| 226 | 葡萄牙文     | `Portuguese_Jovialman`                      | Jovial Man                |
| 227 | 葡萄牙文     | `Portuguese_CharmingQueen`                  | Charming Queen            |
| 228 | 葡萄牙文     | `Portuguese_SantaClaus`                     | Santa Claus               |
| 229 | 葡萄牙文     | `Portuguese_Rudolph`                        | Rudolph                   |
| 230 | 葡萄牙文     | `Portuguese_Arnold`                         | Arnold                    |
| 231 | 葡萄牙文     | `Portuguese_CharmingSanta`                  | Charming Santa            |
| 232 | 葡萄牙文     | `Portuguese_CharmingLady`                   | Charming Lady             |
| 233 | 葡萄牙文     | `Portuguese_Ghost`                          | Ghost                     |
| 234 | 葡萄牙文     | `Portuguese_HumorousElder`                  | Humorous Elder            |
| 235 | 葡萄牙文     | `Portuguese_CalmLeader`                     | Calm Leader               |
| 236 | 葡萄牙文     | `Portuguese_GentleTeacher`                  | Gentle Teacher            |
| 237 | 葡萄牙文     | `Portuguese_EnergeticBoy`                   | Energetic Boy             |
| 238 | 葡萄牙文     | `Portuguese_ReliableMan`                    | Reliable Man              |
| 239 | 葡萄牙文     | `Portuguese_SereneElder`                    | Serene Elder              |
| 240 | 葡萄牙文     | `Portuguese_GrimReaper`                     | Grim Reaper               |
| 241 | 葡萄牙文     | `Portuguese_AssertiveQueen`                 | Assertive Queen           |
| 242 | 葡萄牙文     | `Portuguese_WhimsicalGirl`                  | Whimsical Girl            |
| 243 | 葡萄牙文     | `Portuguese_StressedLady`                   | Stressed Lady             |
| 244 | 葡萄牙文     | `Portuguese_FriendlyNeighbor`               | Friendly Neighbor         |
| 245 | 葡萄牙文     | `Portuguese_CaringGirlfriend`               | Caring Girlfriend         |
| 246 | 葡萄牙文     | `Portuguese_PowerfulSoldier`                | Powerful Soldier          |
| 247 | 葡萄牙文     | `Portuguese_FascinatingBoy`                 | Fascinating Boy           |
| 248 | 葡萄牙文     | `Portuguese_RomanticHusband`                | Romantic Husband          |
| 249 | 葡萄牙文     | `Portuguese_StrictBoss`                     | Strict Boss               |
| 250 | 葡萄牙文     | `Portuguese_InspiringLady`                  | Inspiring Lady            |
| 251 | 葡萄牙文     | `Portuguese_PlayfulSpirit`                  | Playful Spirit            |
| 252 | 葡萄牙文     | `Portuguese_ElegantGirl`                    | Elegant Girl              |
| 253 | 葡萄牙文     | `Portuguese_CompellingGirl`                 | Compelling Girl           |
| 254 | 葡萄牙文     | `Portuguese_PowerfulVeteran`                | Powerful Veteran          |
| 255 | 葡萄牙文     | `Portuguese_SensibleManager`                | Sensible Manager          |
| 256 | 葡萄牙文     | `Portuguese_ThoughtfulLady`                 | Thoughtful Lady           |
| 257 | 葡萄牙文     | `Portuguese_TheatricalActor`                | Theatrical Actor          |
| 258 | 葡萄牙文     | `Portuguese_FragileBoy`                     | Fragile Boy               |
| 259 | 葡萄牙文     | `Portuguese_ChattyGirl`                     | Chatty Girl               |
| 260 | 葡萄牙文     | `Portuguese_Conscientiousinstructor`        | Conscientious Instructor  |
| 261 | 葡萄牙文     | `Portuguese_RationalMan`                    | Rational Man              |
| 262 | 葡萄牙文     | `Portuguese_WiseScholar`                    | Wise Scholar              |
| 263 | 葡萄牙文     | `Portuguese_FrankLady`                      | Frank Lady                |
| 264 | 葡萄牙文     | `Portuguese_DeterminedManager`              | Determined Manager        |
| 265 | 法文       | `French_Male_Speech_New`                    | Level-Headed Man          |
| 266 | 法文       | `French_Female_News Anchor`                 | Patient Female Presenter  |
| 267 | 法文       | `French_CasualMan`                          | Casual Man                |
| 268 | 法文       | `French_MovieLeadFemale`                    | Movie Lead Female         |
| 269 | 法文       | `French_FemaleAnchor`                       | Female Anchor             |
| 270 | 法文       | `French_MaleNarrator`                       | Male Narrator             |
| 271 | 印尼文      | `Indonesian_SweetGirl`                      | Sweet Girl                |
| 272 | 印尼文      | `Indonesian_ReservedYoungMan`               | Reserved Young Man        |
| 273 | 印尼文      | `Indonesian_CharmingGirl`                   | Charming Girl             |
| 274 | 印尼文      | `Indonesian_CalmWoman`                      | Calm Woman                |
| 275 | 印尼文      | `Indonesian_ConfidentWoman`                 | Confident Woman           |
| 276 | 印尼文      | `Indonesian_CaringMan`                      | Caring Man                |
| 277 | 印尼文      | `Indonesian_BossyLeader`                    | Bossy Leader              |
| 278 | 印尼文      | `Indonesian_DeterminedBoy`                  | Determined Boy            |
| 279 | 印尼文      | `Indonesian_GentleGirl`                     | Gentle Girl               |
| 280 | 德文       | `German_FriendlyMan`                        | Friendly Man              |
| 281 | 德文       | `German_SweetLady`                          | Sweet Lady                |
| 282 | 德文       | `German_PlayfulMan`                         | Playful Man               |
| 283 | 俄文       | `Russian_HandsomeChildhoodFriend`           | Handsome Childhood Friend |
| 284 | 俄文       | `Russian_BrightHeroine`                     | Bright Queen              |
| 285 | 俄文       | `Russian_AmbitiousWoman`                    | Ambitious Woman           |
| 286 | 俄文       | `Russian_ReliableMan`                       | Reliable Man              |
| 287 | 俄文       | `Russian_CrazyQueen`                        | Crazy Girl                |
| 288 | 俄文       | `Russian_PessimisticGirl`                   | Pessimistic Girl          |
| 289 | 俄文       | `Russian_AttractiveGuy`                     | Attractive Guy            |
| 290 | 俄文       | `Russian_Bad-temperedBoy`                   | Bad-tempered Boy          |
| 291 | 意大利文     | `Italian_BraveHeroine`                      | Brave Heroine             |
| 292 | 意大利文     | `Italian_Narrator`                          | Narrator                  |
| 293 | 意大利文     | `Italian_WanderingSorcerer`                 | Wandering Sorcerer        |
| 294 | 意大利文     | `Italian_DiligentLeader`                    | Diligent Leader           |
| 295 | 阿拉伯文     | `Arabic_CalmWoman`                          | Calm Woman                |
| 296 | 阿拉伯文     | `Arabic_FriendlyGuy`                        | Friendly Guy              |
| 297 | 土耳其文     | `Turkish_CalmWoman`                         | Calm Woman                |
| 298 | 土耳其文     | `Turkish_Trustworthyman`                    | Trustworthy man           |
| 299 | 乌克兰文     | `Ukrainian_CalmWoman`                       | Calm Woman                |
| 300 | 乌克兰文     | `Ukrainian_WiseScholar`                     | Wise Scholar              |
| 301 | 荷兰文      | `Dutch_kindhearted_girl`                    | Kind-hearted girl         |
| 302 | 荷兰文      | `Dutch_bossy_leader`                        | Bossy leader              |
| 303 | 越南文      | `Vietnamese_kindhearted_girl`               | Kind-hearted girl         |
| 304 | 泰文       | `Thai_male_1_sample8`                       | Serene Man                |
| 305 | 泰文       | `Thai_male_2_sample2`                       | Friendly Man              |
| 306 | 泰文       | `Thai_female_1_sample1`                     | Confident Woman           |
| 307 | 泰文       | `Thai_female_2_sample2`                     | Energetic Woman           |
| 308 | 波兰文      | `Polish_male_1_sample4`                     | Male Narrator             |
| 309 | 波兰文      | `Polish_male_2_sample3`                     | Male Anchor               |
| 310 | 波兰文      | `Polish_female_1_sample1`                   | Calm Woman                |
| 311 | 波兰文      | `Polish_female_2_sample3`                   | Casual Woman              |
| 312 | 罗马尼亚文    | `Romanian_male_1_sample2`                   | Reliable Man              |
| 313 | 罗马尼亚文    | `Romanian_male_2_sample1`                   | Energetic Youth           |
| 314 | 罗马尼亚文    | `Romanian_female_1_sample4`                 | Optimistic Youth          |
| 315 | 罗马尼亚文    | `Romanian_female_2_sample1`                 | Gentle Woman              |
| 316 | 希腊文      | `greek_male_1a_v1`                          | Thoughtful Mentor         |
| 317 | 希腊文      | `Greek_female_1_sample1`                    | Gentle Lady               |
| 318 | 希腊文      | `Greek_female_2_sample3`                    | Girl Next Door            |
| 319 | 捷克文      | `czech_male_1_v1`                           | Assured Presenter         |
| 320 | 捷克文      | `czech_female_5_v7`                         | Steadfast Narrator        |
| 321 | 捷克文      | `czech_female_2_v2`                         | Elegant Lady              |
| 322 | 芬兰文      | `finnish_male_3_v1`                         | Upbeat Man                |
| 323 | 芬兰文      | `finnish_male_1_v2`                         | Friendly Boy              |
| 324 | 芬兰文      | `finnish_female_4_v1`                       | Assetive Woman            |
| 325 | 印地文      | `hindi_male_1_v2`                           | Trustworthy Advisor       |
| 326 | 印地文      | `hindi_female_2_v1`                         | Tranquil Woman            |
| 327 | 印地文      | `hindi_female_1_v2`                         | News Anchor               |



## 查询音色
> ## Documentation Index
> Fetch the complete documentation index at: https://platform.minimaxi.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 查询可用音色ID

> 使用本接口支持查询不同分类下的音色信息。

该 API 支持查询**当前账号**下可调用的**全部音色 ID**（voice\_id）。

包括系统音色、快速克隆音色、文生音色接口生成的音色、音乐生成接口的人声音色以及伴奏音色。

<Note>
  快速复刻得到的音色为未激活状态，需正式调用一次才可在本接口查询到
</Note>


## OpenAPI

````yaml api-reference/speech/voice-management/api/openapi.json POST /v1/get_voice
openapi: 3.1.0
info:
  title: MiniMax Voice Management API
  description: MiniMax Voice Management API with support for getting and deleting voices
  license:
    name: MIT
  version: 1.0.0
servers:
  - url: https://api.minimaxi.com
security:
  - bearerAuth: []
paths:
  /v1/get_voice:
    post:
      tags:
        - Voice
      summary: Get Voice
      operationId: getVoice
      parameters:
        - name: Content-Type
          in: header
          required: true
          description: 请求体的媒介类型，请设置为 `application/json`，确保请求数据的格式为 JSON
          schema:
            type: string
            enum:
              - application/json
            default: application/json
      requestBody:
        description: ''
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GetVoiceReq'
        required: true
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GetVoiceResp'
components:
  schemas:
    GetVoiceReq:
      type: object
      required:
        - voice_type
      properties:
        voice_type:
          type: string
          description: |-
            希望查询音色类型，支持以下取值：

            - `system`: 系统音色
            - `voice_cloning`: 快速复刻的音色，仅在成功用于语音合成后才可查询
            - `voice_generation`: 文生音色接口生成的音色，仅在成功用于语音合成后才可查询
            - `all`: 以上全部
          enum:
            - system
            - voice_cloning
            - voice_generation
            - all
      example:
        voice_type: all
    GetVoiceResp:
      type: object
      properties:
        system_voice:
          type: array
          items:
            $ref: '#/components/schemas/SystemVoiceInfo'
          description: 包含系统预定义的音色。
        voice_cloning:
          type: array
          items:
            $ref: '#/components/schemas/VoiceCloningInfo'
          description: 包含音色快速复刻的音色数据
        voice_generation:
          type: array
          items:
            $ref: '#/components/schemas/VoiceGenerationInfo'
          description: 包含音色生成接口产生的音色数据
        base_resp:
          $ref: '#/components/schemas/BaseResp'
      example:
        system_voice:
          - voice_id: Chinese (Mandarin)_Reliable_Executive
            description:
              - 一位沉稳可靠的中年男性高管声音，标准普通话，传递出值得信赖的感觉。
            voice_name: 沉稳高管
            created_time: '1970-01-01'
          - voice_id: Chinese (Mandarin)_News_Anchor
            description:
              - 一位专业、播音腔的中年女性新闻主播，标准普通话。
            voice_name: 新闻女声
            created_time: '1970-01-01'
        voice_cloning:
          - voice_id: test12345
            description: []
            created_time: '2025-08-20'
          - voice_id: test12346
            description: []
            created_time: '2025-08-21'
        voice_generation:
          - voice_id: ttv-voice-2025082011321125-2uEN0X1S
            description: []
            created_time: '2025-08-20'
          - voice_id: ttv-voice-2025082014225025-ZCQt0U0k
            description: []
            created_time: '2025-08-20'
        base_resp:
          status_code: 0
          status_msg: success
    SystemVoiceInfo:
      type: object
      properties:
        voice_id:
          type: string
          description: 音色 ID
        voice_name:
          type: string
          description: 音色名称，非调用的音色 ID
        description:
          type: array
          items:
            type: string
          description: 音色描述
    VoiceCloningInfo:
      type: object
      properties:
        voice_id:
          type: string
          description: 音色 ID
        description:
          type: array
          items:
            type: string
          description: 生成音色时填写的音色描述
        created_time:
          type: string
          description: 创建时间，格式 yyyy-mm-dd
    VoiceGenerationInfo:
      type: object
      properties:
        voice_id:
          type: string
          description: 音色 ID
        description:
          type: array
          items:
            type: string
          description: 生成音色时填写的音色描述
        created_time:
          type: string
          description: 创建时间，格式 yyyy-mm-dd
    BaseResp:
      type: object
      description: 本次请求的状态码和详情
      properties:
        status_code:
          type: integer
          format: int64
          description: |-
            状态码。

            - `0`: 请求结果正常
            - `2013`: 输入参数信息不正常

            更多内容可查看 [错误码查询列表](/api-reference/errorcode) 了解详情
        status_msg:
          type: string
          description: 状态详情
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |-
        `HTTP: Bearer Auth`
         - Security Scheme Type: http
         - HTTP Authorization Scheme: Bearer API_key，用于验证账户信息，可在 [账户管理>接口密钥](https://platform.minimaxi.com/user-center/basic-information/interface-key) 中查看。

````




‘’‘’‘’
> ## Documentation Index
> Fetch the complete documentation index at: https://platform.minimaxi.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Anthropic SDK

> 通过 Anthropic SDK 调用 MiniMax 模型

为了满足开发者对 Anthropic API 生态的使用需求，我们的 API 新增了对 Anthropic API 格式的支持。通过简单的配置，即可将 MiniMax 的能力接入到 Anthropic API 生态中。

## 快速开始

### 1. 安装 Anthropic SDK

<CodeGroup>
  ```bash Python theme={null}
  pip install anthropic
  ```

  ```bash Node.js theme={null}
  npm install @anthropic-ai/sdk
  ```
</CodeGroup>

### 2. 配置环境变量

```bash theme={null}
export ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
export ANTHROPIC_API_KEY=${YOUR_API_KEY}
```

### 3. 调用 API

```python Python theme={null}
import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
    model="MiniMax-M3",
    max_tokens=1000,
    system="You are a helpful assistant.",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Hi, how are you?"
                }
            ]
        }
    ]
)

for block in message.content:
    if block.type == "thinking":
        print(f"Thinking:\n{block.thinking}\n")
    elif block.type == "text":
        print(f"Text:\n{block.text}\n")
```

### 4. 特别注意

在多轮 Function Call 对话中，必须将完整的模型返回（即 assistant 消息）添加到对话历史，以保持思维链的连续性：

* 将完整的 `response.content`（包含 thinking/text/tool\_use 等所有块）添加到消息历史
* `response.content` 是一个列表，包含多种类型的内容块，必须完整回传

## 支持的模型

使用 Anthropic SDK 时，支持 `MiniMax-M3` `MiniMax-M2.7` `MiniMax-M2.7-highspeed` `MiniMax-M2.5` `MiniMax-M2.5-highspeed` `MiniMax-M2.1` `MiniMax-M2.1-highspeed` `MiniMax-M2`  模型：

| 模型名称                   |   上下文窗口   | 模型介绍                                        |
| :--------------------- | :-------: | :------------------------------------------ |
| MiniMax-M3             | 1,000,000 | **最新 M 系列语言模型，适用于 Agent 推理、工具调用、代码和长上下文任务** |
| MiniMax-M2.7           |  204,800  | **开启模型的自我迭代**（输出速度约 60 TPS）                 |
| MiniMax-M2.7-highspeed |  204,800  | **M2.7 极速版：效果不变，更快，更敏捷**（输出速度约 100 TPS）     |
| MiniMax-M2.5           |  204,800  | **顶尖性能与极致性价比，轻松驾驭复杂任务**（输出速度约 60 TPS）       |
| MiniMax-M2.5-highspeed |  204,800  | **M2.5 极速版：效果不变，更快，更敏捷**（输出速度约 100 TPS）     |
| MiniMax-M2.1           |  204,800  | **强大多语言编程能力，全面升级编程体验**（输出速度约 60 TPS）        |
| MiniMax-M2.1-highspeed |  204,800  | **M2.1 极速版：效果不变，更快，更敏捷**（输出速度约 100 TPS）     |
| MiniMax-M2             |  204,800  | **专为高效编码与 Agent 工作流而生**                     |

<Note>
  TPS（Tokens Per Second）的计算方式详见[常见问题 > 接口相关](/faq/about-apis#%E9%97%AE%E6%96%87%E6%9C%AC%E6%A8%A1%E5%9E%8B%E7%9A%84-tpstokens-per-second%E6%98%AF%E5%A6%82%E4%BD%95%E8%AE%A1%E7%AE%97%E7%9A%84)。
</Note>

<Note>
  Anthropic API 兼容接口支持 `MiniMax-M3` `MiniMax-M2.7` `MiniMax-M2.7-highspeed` `MiniMax-M2.5` `MiniMax-M2.5-highspeed` `MiniMax-M2.1` `MiniMax-M2.1-highspeed` `MiniMax-M2`
  模型。如需使用其他模型，请使用标准的 MiniMax API 接口。
</Note>

## 兼容性说明

### 支持的参数

在使用 Anthropic SDK 接入时，我们支持以下输入参数：

| 参数                   | 支持状态 | 说明                                                                                                                                                              |
| :------------------- | :--- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`              | 完全支持 | 支持 `MiniMax-M3` `MiniMax-M2.7` `MiniMax-M2.7-highspeed` `MiniMax-M2.5` `MiniMax-M2.5-highspeed` `MiniMax-M2.1` `MiniMax-M2.1-highspeed` `MiniMax-M2` 模型         |
| `messages`           | 部分支持 | `MiniMax-M3` 支持文本、图片、视频、工具调用、工具结果和 thinking 内容块。M2.7、M2.5、M2.1 和 M2 系列仅支持文本与工具调用相关内容块，不支持图片和视频输入                                                                |
| `max_tokens`         | 完全支持 | 最大生成 token 数                                                                                                                                                    |
| `stream`             | 完全支持 | 流式响应                                                                                                                                                            |
| `system`             | 完全支持 | 系统提示词                                                                                                                                                           |
| `temperature`        | 完全支持 | 取值范围 \[0, 2]，控制输出随机性，建议取值 1                                                                                                                                     |
| `tool_choice`        | 完全支持 | 工具选择策略                                                                                                                                                          |
| `tools`              | 完全支持 | 工具定义                                                                                                                                                            |
| `top_p`              | 完全支持 | 核采样参数，取值范围 \[0, 1]，`MiniMax-M3` 默认值 0.95，M2.x 系列默认值 0.9                                                                                                         |
| `thinking`           | 完全支持 | MiniMax-M3 默认关闭 thinking，可通过 `adaptive` 开启。M2.x 模型的 thinking 无法关闭。                                                                                              |
| `metadata`           | 完全支持 | 元信息                                                                                                                                                             |
| `service_tier`       | 完全支持 | 请求准入服务层级。支持的取值为 `standard` 和 `priority`；省略时默认使用 `standard`。`priority` 的[价格](/guides/pricing-paygo)为 `standard` 的 1.5 倍，并会确保请求获得优先准入，使其排在其他请求之前处理，从而带来更快响应并减少失败。 |
| `top_k`              | 忽略   | 该参数会被忽略                                                                                                                                                         |
| `stop_sequences`     | 忽略   | 该参数会被忽略                                                                                                                                                         |
| `mcp_servers`        | 忽略   | 该参数会被忽略                                                                                                                                                         |
| `context_management` | 忽略   | 该参数会被忽略                                                                                                                                                         |
| `container`          | 忽略   | 该参数会被忽略                                                                                                                                                         |

### Thinking 控制

对于 `MiniMax-M3`，`thinking` 参数用于控制模型是否可以输出 `thinking` 内容块。

* 如果省略 `thinking`，默认关闭 thinking，响应不会包含 `thinking` 内容块。
* 设置 `thinking: {"type": "adaptive"}` 可显式开启 thinking。对于 MiniMax-M3，`adaptive` 等同于开启 thinking。
* 设置 `thinking: {"type": "disabled"}` 可显式保持 MiniMax-M3 的 thinking 输出关闭。
* 对于 M2.x 模型，thinking 无法关闭；即使传入 `thinking: {"type": "disabled"}`，thinking 仍会保持开启。

当响应包含 `thinking` 内容块时，后续轮次中应原样保留这些内容块，尤其是在工具调用对话中。

### Messages 字段支持

| 字段类型                 | 支持状态 | 说明                                                            |
| :------------------- | :--- | :------------------------------------------------------------ |
| `type="text"`        | 完全支持 | 文本消息                                                          |
| `type="image"`       | 仅 M3 | 通过 URL 或 base64 输入图片，支持 JPEG、PNG、GIF、WEBP                     |
| `type="video"`       | 仅 M3 | 通过 URL、base64 或 `mm_file://{file_id}` 输入视频，支持 MP4、AVI、MOV、MKV |
| `type="tool_use"`    | 完全支持 | 工具调用                                                          |
| `type="tool_result"` | 完全支持 | 工具调用结果                                                        |
| `type="thinking"`    | 完全支持 | 推理内容。多轮 thinking 对话中需要原样回带                                    |

对 `MiniMax-M3`，URL 或 base64 视频最大 50 MB，图片最大 10 MB，请求体最大 64 MB。更大的视频请通过 Files API 上传后传入 `mm_file://{file_id}`，Files API 视频最大 512 MB。

图片 token 用量会随图片尺寸和内容变化。以下是单张图片的粗略估算；准确用量以 `POST /anthropic/v1/messages/count_tokens` 或响应中的 `usage` 为准：

| `detail`  | 单张图片粗略 token 用量        |
| :-------- | :--------------------- |
| `low`     | 通常为几百 token，最高约 600    |
| `default` | 通常约 1k-3k token，最高约 5k |
| `high`    | 通常为数千 token，最高约 15k+   |

Anthropic API 兼容接口也支持 `POST /anthropic/v1/messages/count_tokens`，可用于 `MiniMax-M3` 调用前预估输入 token 用量，不会生成模型输出。

## 示例代码

### 流式响应

```python Python theme={null}
import anthropic

client = anthropic.Anthropic()

print("Starting stream response...\n")
print("=" * 60)
print("Thinking Process:")
print("=" * 60)

stream = client.messages.create(
    model="MiniMax-M3",
    max_tokens=1000,
    system="You are a helpful assistant.",
    messages=[
        {"role": "user", "content": [{"type": "text", "text": "Hi, how are you?"}]}
    ],
    stream=True,
)

reasoning_buffer = ""
text_buffer = ""

for chunk in stream:
    if chunk.type == "content_block_start":
        if hasattr(chunk, "content_block") and chunk.content_block:
            if chunk.content_block.type == "text":
                print("\n" + "=" * 60)
                print("Response Content:")
                print("=" * 60)

    elif chunk.type == "content_block_delta":
        if hasattr(chunk, "delta") and chunk.delta:
            if chunk.delta.type == "thinking_delta":
                # 流式输出 thinking 过程
                new_thinking = chunk.delta.thinking
                if new_thinking:
                    print(new_thinking, end="", flush=True)
                    reasoning_buffer += new_thinking
            elif chunk.delta.type == "text_delta":
                # 流式输出文本内容
                new_text = chunk.delta.text
                if new_text:
                    print(new_text, end="", flush=True)
                    text_buffer += new_text

print("\n")
```

## 注意事项

如果在使用模型过程中遇到任何问题：

* 通过邮箱 [Model@minimaxi.com](mailto:Model@minimaxi.com) 等官方渠道联系我们的技术支持团队
* 在我们的 [Github](https://github.com/MiniMax-AI/MiniMax-M2/issues) 仓库提交Issue

<Warning>
  1. Anthropic API 兼容接口目前支持 `MiniMax-M3` `MiniMax-M2.7` `MiniMax-M2.7-highspeed` `MiniMax-M2.5` `MiniMax-M2.5-highspeed` `MiniMax-M2.1` `MiniMax-M2.1-highspeed` `MiniMax-M2`  模型

  2. `temperature` 参数取值范围为 \[0, 2]，推荐使用1.0，超出范围会返回错误

  3. 部分 Anthropic 参数（如 `top_k`、`stop_sequences`、`mcp_servers`、`context_management`、`container`）会被忽略

  4. `MiniMax-M3` 支持通过 Anthropic 兼容内容块输入图片和视频；M2.7、M2.5、M2.1 和 M2 系列仅支持文本与工具调用相关内容块
</Warning>



‘’‘’‘’




‘’‘’‘’‘
> ## Documentation Index
> Fetch the complete documentation index at: https://platform.minimaxi.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# 音色快速复刻

> 使用本接口进行音色快速复刻。
复刻得到的音色若 7 天内未正式调用，则系统会删除该音色。
调用本接口前，请先完成个人或企业认证。



## OpenAPI

````yaml api-reference/speech/voice-cloning/api/openapi.json POST /v1/voice_clone
openapi: 3.1.0
info:
  title: MiniMax Voice Cloning API
  description: MiniMax Voice Cloning API with support for voice cloning and file upload
  license:
    name: MIT
  version: 1.0.0
servers:
  - url: https://api.minimaxi.com
security:
  - bearerAuth: []
paths:
  /v1/voice_clone:
    post:
      tags:
        - Voice
      summary: Voice Clone
      operationId: voiceClone
      requestBody:
        description: Voice clone request parameters
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VoiceCloneReq'
        required: true
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VoiceCloneResp'
components:
  schemas:
    VoiceCloneReq:
      type: object
      required:
        - file_id
        - voice_id
      properties:
        file_id:
          type: integer
          format: int64
          description: |-
            待复刻音频的 file_id，通过[文件上传接口](/api-reference/file-management-upload)获得
            上传的待复刻音频文件需遵从以下规范：

            - 上传的音频文件格式需为：mp3、m4a、wav 格式
            - 上传的音频文件的时长最少应不低于 10 秒，最长应不超过 5 分钟
            - 上传的音频文件大小需不超过 20 mb
            - 若使用该参数，则两个子属性（prompt_audio、prompt_text）都为必填项
        voice_id:
          type: string
          description: |-
            克隆音色的 voice_id，正确示例："MiniMax001"。用户进行自定义 voice_id 时需注意：

            - 自定义的 voice_id 长度范围[8,256]
            - 首字符必须为英文字母
            - 允许数字、字母、-、_
            - 末位字符不可为 -、_
            - voice_id 不可与已有 id 重复，否则会报错
        clone_prompt:
          $ref: '#/components/schemas/ClonePrompt'
          description: |-
            音色复刻示例音频，提供本参数将有助于增强语音合成的音色相似度和稳定性。若使用本参数，需同时上传一小段示例音频
            上传的音频文件需遵从以下规范：

            - 上传的音频文件格式需为：mp3、m4a、wav 格式
            - 上传的音频文件的时长小于 8 秒
            - 上传的音频文件大小需不超过 20 mb
        text:
          type: string
          description: >-
            复刻试听参数，限制 1000 字符以内。模型将使用复刻后的音色朗读本段文本内容，并返回试听音频链接。
             注：试听将根据字符数正常收取语音合成费用，定价与 T2A 各接口一致
            - 语气词标签：仅当模型选择 `speech-2.8-hd` 或 `speech-2.8-turbo`
            时，支持在文本中插入语气词标签。支持的语气词：`(laughs)`（笑声）、`(chuckle)`（轻笑）、`(coughs)`（咳嗽）、`(clear-throat)`（清嗓子）、`(groans)`（呻吟）、`(breath)`（正常换气）、`(pant)`（喘气）、`(inhale)`（吸气）、`(exhale)`（呼气）、`(gasps)`（倒吸气）、`(sniffs)`（吸鼻子）、`(sighs)`（叹气）、`(snorts)`（喷鼻息）、`(burps)`（打嗝）、`(lip-smacking)`（咂嘴）、`(humming)`（哼唱）、`(hissing)`（嘶嘶声）、`(emm)`（嗯）、`(whistles)`（口哨）、`(sneezes)`（喷嚏）、`(crying)`（抽泣）、`(applause)`（鼓掌）
        model:
          type: string
          description: 复刻试听参数。指定合成试听音频使用的语音模型，提供 `text` 字段时必传此字段。可选项：
          enum:
            - speech-2.8-hd
            - speech-2.8-turbo
            - speech-2.6-hd
            - speech-2.6-turbo
            - speech-02-hd
            - speech-02-turbo
            - speech-01-hd
            - speech-01-turbo
        language_boost:
          type: string
          description: 是否增强对指定的小语种和方言的识别能力。默认值为 null，可设置为 `auto` 让模型自主判断。
          enum:
            - Chinese
            - Chinese,Yue
            - English
            - Arabic
            - Russian
            - Spanish
            - French
            - Portuguese
            - German
            - Turkish
            - Dutch
            - Ukrainian
            - Vietnamese
            - Indonesian
            - Japanese
            - Italian
            - Korean
            - Thai
            - Polish
            - Romanian
            - Greek
            - Czech
            - Finnish
            - Hindi
            - Bulgarian
            - Danish
            - Hebrew
            - Malay
            - Persian
            - Slovak
            - Swedish
            - Croatian
            - Filipino
            - Hungarian
            - Norwegian
            - Slovenian
            - Catalan
            - Nynorsk
            - Tamil
            - Afrikaans
            - auto
        text_validation:
          type: string
          description: >-
            可选参数。音频复刻样本（`file_id` 或 `clone_prompt.prompt_audio`
            中的音频）的预期文本内容。提供后，服务会对该音频做 ASR 识别，并将识别文本与 `text_validation`
            做相似度比对；若相似度低于 `accuracy`，请求会被拒绝并返回错误码 `1043`（`The asr similarity
            check failed`）。长度上限 200 字符。
          maxLength: 200
        accuracy:
          type: number
          format: double
          description: >-
            可选参数。配合 `text_validation` 使用的 ASR 相似度阈值，取值范围 `[0, 1]`。未传或传 `0` 时取默认值
            `0.7`。
          minimum: 0
          maximum: 1
          default: 0.7
        need_noise_reduction:
          type: boolean
          description: 音频复刻参数，表示是否开启降噪，默认值为 false
          default: false
        need_volume_normalization:
          type: boolean
          description: 音频复刻参数，是否开启音量归一化，默认值为 false
          default: false
        aigc_watermark:
          type: boolean
          description: 是否在合成试听音频的末尾添加音频节奏标识，默认值为 false
          default: false
      example:
        file_id: 123456789
        voice_id: <voice_id>
        clone_prompt:
          prompt_audio: 987654321
          prompt_text: This voice sounds natural and pleasant.
        text: >-
          A gentle breeze sweeps across the soft grass(breath), carrying the
          fresh scent along with the songs of birds.
        model: speech-2.8-hd
        text_validation: This voice sounds natural and pleasant.
        accuracy: 0.7
        need_noise_reduction: false
        need_volume_normalization: false
        aigc_watermark: false
    VoiceCloneResp:
      type: object
      properties:
        input_sensitive:
          type: object
          description: 输入音频是否命中风控
          properties:
            type:
              type: integer
              description: |-
                输入音频命中风控的类型，取值为以下其一：

                - 0：正常
                - 1：严重违规
                - 2：色情
                - 3：广告
                - 4：违禁
                - 5：谩骂
                - 6：暴恐
                - 7：其他
        demo_audio:
          type: string
          description: 如果请求体中传入了试听文本 text 以及合成试听音频的模型 model，那么本参数将以链接形式返回试听音频，否则本参数为空值
        extra_info:
          type: object
          description: 试听音频的元信息和计费信息。仅当请求中带 `text`（即触发了试听合成、有计费）时返回。字段结构与 `/v1/t2a_v2` 对齐
          properties:
            audio_length:
              type: integer
              format: int64
              description: 试听音频时长（毫秒）
            audio_sample_rate:
              type: integer
              format: int64
              description: 试听音频采样率
            audio_size:
              type: integer
              format: int64
              description: 试听音频文件大小（字节）
            bitrate:
              type: integer
              format: int64
              description: 试听音频比特率
            word_count:
              type: integer
              format: int64
              description: 已发音的字数统计，包含汉字、数字、字母，不包含标点符号
            usage_characters:
              type: integer
              format: int64
              description: 本次试听合成的计费字符数，可用于和账单进行对账
        base_resp:
          $ref: '#/components/schemas/VoiceCloneBaseResponse'
      example:
        input_sensitive: false
        input_sensitive_type: 0
        demo_audio: ''
        extra_info:
          audio_length: 11124
          audio_sample_rate: 32000
          audio_size: 179926
          bitrate: 128000
          word_count: 18
          usage_characters: 18
        base_resp:
          status_code: 0
          status_msg: success
    ClonePrompt:
      type: object
      properties:
        prompt_audio:
          type: integer
          format: int64
          description: 示例音频的 file_id，通过 [文件上传接口](/api-reference/file-management-upload) 获得
        prompt_text:
          type: string
          description: 示例音频的对应文本，需确保和音频内容一致，句末需有标点符号做结尾
    VoiceCloneBaseResponse:
      type: object
      required:
        - status_code
      properties:
        status_code:
          type: integer
          format: int64
          description: |-
            状态码

            - 0: 请求结果正常
            - 1000：未知错误
            - 1001：超时
            - 1002：触发限流
            - 1004：鉴权失败
            - 1013：服务内部错误
            - 2013：输入格式信息不正常
            - 2038：无复刻权限，请检查账号认证状态

            更多内容可查看[错误码查询列表](/api-reference/errorcode)了解详情
        status_msg:
          type: string
          description: 状态详情
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |-
        `HTTP: Bearer Auth`
         - Security Scheme Type: http
         - HTTP Authorization Scheme: Bearer API_key，用于验证账户信息，可在 [账户管理>接口密钥](https://platform.minimaxi.com/user-center/basic-information/interface-key) 中查看。

````


’‘’‘’‘