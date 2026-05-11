import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

enum ProService {
  YES = 1,
  NO = 0,
}
interface ServiceProps {
  title: string;
  pro: ProService;
  description: string;
}
const serviceList: ServiceProps[] = [
  {
    title: "自定义域名接入",
    description:
      "将落地页绑定到你的品牌域名，统一访问入口与搜索引擎展示。",
    pro: 0,
  },
  {
    title: "社交媒体整合",
    description:
      "一键展示各渠道账号与分享入口，方便访客关注与传播。",
    pro: 0,
  },
  {
    title: "邮件营销对接",
    description: "与常用邮件服务连通，收集线索并做自动化培育。",
    pro: 0,
  },
  {
    title: "SEO 优化",
    description: "语义化结构与元信息建议，帮助页面更易被检索与分享。",
    pro: 1,
  },
];

export const ServicesSection = () => {
  return (
    <section id="services" className="container py-24 sm:py-32">
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
        服务
      </h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
        助力业务增长
      </h2>
      <h3 className="md:w-1/2 mx-auto text-xl text-center text-muted-foreground mb-8">
        从获客到运营落地，我们提供有偿的运营建议，帮您高效地达成阶段目标。
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full lg:w-[60%] mx-auto">
        {serviceList.map(({ title, description, pro }) => (
          <Card
            key={title}
            className="bg-muted/60 dark:bg-card h-full relative"
          >
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <Badge
              data-pro={ProService.YES === pro}
              variant="secondary"
              className="absolute -top-2 -right-3 data-[pro=false]:hidden"
            >
              专业版
            </Badge>
          </Card>
        ))}
      </div>
    </section>
  );
};
