import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { icons } from "lucide-react";

interface BenefitsProps {
  icon: string;
  title: string;
  description: string;
}

const benefitList: BenefitsProps[] = [
  {
    icon: "Blocks",
    title: "一站式AI能力中枢",
    description:
      "从导航站发现工具，到应用直接落地，再到课程系统学习。打通“找、用、学”闭环，让一人公司、创业老板不再碎片化摸索，一个平台配齐你的AI基建。",
  },
  {
    icon: "LineChart",
    title: "加速个人与业务增长",
    description:
      "精选垂直场景AI工具（写作/视频/编程/办公），搭配实战课程，帮你把AI转化为内容产出、营销转化、效率提升的实际结果。从“忙不过来”到“一个人撑起一条龙”",
  },
  {
    icon: "Wallet",
    title: "降低试错与决策成本",
    description:
      "导航站帮你筛掉90%不合适的工具，课程教你怎么用对、用好。不用再花几个月踩坑，用最少的时间和金钱找到最适合你业务的AI方案。",
  },
  {
    icon: "Sparkle",
    title: "持续进化与生态协同",
    description:
      "模块化内容快速迭代，紧跟AI前沿。导航站、工具、课程三者互相引流，形成用户粘性。一人公司可长期依赖这个生态保持竞争力，AI能力随你一起成长。",
  },
];

export const BenefitsSection = () => {
  return (
    <section id="benefits" className="container py-24 sm:py-32">
      <div className="grid lg:grid-cols-2 place-items-center lg:gap-24">
        <div>
          <h2 className="text-lg text-primary mb-2 tracking-wider">优势</h2>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            AI 成为您的智手
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            让 AI 成为您的助手, 帮助您实现一切的不可能. 一个人就可以。
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 w-full">
          {benefitList.map(({ icon, title, description }, index) => (
            <Card
              key={title}
              className="bg-muted/50 dark:bg-card hover:bg-background transition-all delay-75 group/number"
            >
              <CardHeader>
                <div className="flex justify-between">
                  <Icon
                    name={icon as keyof typeof icons}
                    size={32}
                    color="hsl(var(--primary))"
                    className="mb-6 text-primary"
                  />
                  <span className="text-5xl text-muted-foreground/15 font-medium transition-all delay-75 group-hover/number:text-muted-foreground/30">
                    0{index + 1}
                  </span>
                </div>

                <CardTitle>{title}</CardTitle>
              </CardHeader>

              <CardContent className="text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
