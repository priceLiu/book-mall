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
    question: "注册后要付费才能用吗？",
    answer:
      "浏览与试看对游客开放；免费注册用户可使用个人中心，但在知识/工具的可操作范围上与游客一致。系统化学习与完整工具能力需开通订阅；部分高级应用与大模型调用在订阅有效前提下还需钱包余额按量结算，详见订阅页与个人中心公示。",
    value: "item-1",
  },
  {
    question: "支持哪些浏览器与设备尺寸？",
    answer:
      "本站采用移动优先的响应式布局，主流桌面与移动浏览器均可顺畅访问；课程支持碎片化学习，常用入口在触控场景下同样清晰易点。",
    value: "item-2",
  },
  {
    question: "「找AI上智选」和其他导航站有什么不同？",
    answer:
      "不仅是工具链接聚合：我们按打工人、创业老板、自由职业与转型者等角色，结合办公、写作、视频、编程等场景做筛选，帮助你几步内找到当前任务最匹配的 AI 工具；并与课程、应用形成「找、用、学」闭环，学完能用、用完提效。",
    value: "item-3",
  },
  {
    question: "订阅会员和钱包余额分别用在什么地方？",
    answer:
      "订阅对应知识型/工具型产品中的「普通型」权益（订阅期内通常不再额外扣余额）。进阶内容与高级型工具，以及大模型推理等按量服务，在订阅有效前提下使用充值余额结算；二者互不抵扣，具体边界以站内产品与计费公示为准。",
    value: "item-4",
  },
  {
    question: "遇到问题如何获取帮助？",
    answer:
      "可先查阅本站常见问题与计费公示；亦可通过页脚联系方式反馈，或在登录后通过个人中心查看订单、账单与通知。描述时请尽量附上使用场景与时间点，便于我们核对与回访。",
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
