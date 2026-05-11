import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQProps {
  question: string;
  answer: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    question: "这个模板是免费的吗？",
    answer: "是的。这是一套免费的 Next.js + Shadcn 模板。",
    value: "item-1",
  },
  {
    question: "支持哪些浏览器与设备尺寸？",
    answer:
      "模板采用响应式布局与现代 CSS，主流桌面与移动浏览器均可良好展示；也支持你按需扩展深色模式与无障碍优化。",
    value: "item-2",
  },
  {
    question: "我可以修改品牌色、字体和图片吗？",
    answer:
      "可以。主题变量与组件结构便于替换，你可以快速对齐自有设计规范而无需大改底层代码。",
    value: "item-3",
  },
  {
    question: "是否可用于商业项目？",
    answer:
      "请留意所使用依赖与素材各自的许可协议；模板代码可按你的场景评估后用于对内或对外站点。",
    value: "item-4",
  },
  {
    question: "遇到问题如何获取帮助？",
    answer:
      "可通过仓库 Issue、社区频道或邮件联系维护者，并附上复现步骤与环境信息以便排查。",
    value: "item-5",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="container md:w-[700px] py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          常见问题
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold">
          您可能想了解
        </h2>
      </div>

      <Accordion type="single" collapsible className="AccordionRoot">
        {FAQList.map(({ question, answer, value }) => (
          <AccordionItem key={value} value={value}>
            <AccordionTrigger className="text-left">
              {question}
            </AccordionTrigger>

            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
