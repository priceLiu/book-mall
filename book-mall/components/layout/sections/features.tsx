import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { icons } from "lucide-react";

interface FeaturesProps {
  icon: string;
  title: string;
  description: string;
}

const featureList: FeaturesProps[] = [
  {
    icon: "TabletSmartphone",
    title: "精准角色导航",
    description:
      "不是简单堆砌工具链接，而是按“打工人、创业老板、自由职业、转型者”四大角色 + 场景分类（办公/写作/视频/编程等）。用户3步内就能找到最适合自己当前任务的AI工具，告别大海捞针。",
  },
  {
    icon: "BadgeCheck",
    title: "课程+工具闭环",
    description:
      "每个核心工具都配套实战课程：从“这是什么”到“怎么用”到“用在哪儿”。不只是教操作，而是教会用户把AI嵌入真实工作流。学完就能用，用完就提效。",
  },
  {
    icon: "Goal",
    title: "真实案例与社区验证",
    description:
      "展示一人公司、创业者、转型者使用AI前后的真实数据与案例（如“用AI把文案产出提升3倍”）。配合用户评价与案例库，用社会认同降低决策顾虑，增强下单信心。",
  },
  {
    icon: "PictureInPicture",
    title: "零基础友好+持续陪伴",
    description:
      "设有“AI新手村”：入门指南、工具对比、每周技巧、常见问题FAQ。解决“不知道从哪开始”、“怕学不会”、“没人问”的痛点。课程阶梯式设计，从零到一，再到精通，长期陪跑。",
  },
  {
    icon: "MousePointerClick",
    title: "移动优先+快速上手",
    description:
      "自适应布局与触控优化，手机/平板同样清晰可操作。课程支持碎片化学习，工具即开即用。主按钮与行动路径一目了然，减少找教程、找入口的时间浪费。",
  },
  {
    icon: "Newspaper",
    title: "清晰的价值主张",
    description:
      "一句“找AI，上智选”点明核心，副标题“一人公司、创业老板、自由职业的专属AI加油站”。扫一眼就懂你是做什么的、为谁服务、能解决什么问题。",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="container py-24 sm:py-32">
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
        功能
      </h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
        我们的不同之处
      </h2>

      <h3 className="md:w-1/2 mx-auto text-xl text-center text-muted-foreground mb-8">
      从找到工具到学会用工具，按角色陪跑、课程闭环，让AI真正为你所用
      </h3>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureList.map(({ icon, title, description }) => (
          <div key={title}>
            <Card className="h-full bg-background border-0 shadow-none">
              <CardHeader className="flex justify-center items-center">
                <div className="bg-primary/20 p-2 rounded-full ring-8 ring-primary/10 mb-4">
                  <Icon
                    name={icon as keyof typeof icons}
                    size={24}
                    color="hsl(var(--primary))"
                    className="text-primary"
                  />
                </div>

                <CardTitle>{title}</CardTitle>
              </CardHeader>

              <CardContent className="text-muted-foreground text-center">
                {description}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
};
