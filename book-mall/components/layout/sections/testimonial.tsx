"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Star } from "lucide-react";

interface ReviewProps {
  image: string;
  name: string;
  userName: string;
  comment: string;
  rating: number;
}

const reviewList: ReviewProps[] = [
  {
    image: "https://github.com/shadcn.png",
    name: "苏总",
    userName: "企业负责人",
    comment:
      "可以快速找到我要学习的工具，上手非常快。",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "何总",
    userName: "创业老板",
    comment:
      "非常有帮助, 可以让我快速了解应用, 让公司的运营学习了解并实施应用",
    rating: 4.8,
  },

  {
    image: "https://github.com/shadcn.png",
    name: "王浩",
    userName: "技术负责人",
    comment:
      "界面层级清晰，学习与演示路径一目了然，对内培训和对外讲解都很省心。",
    rating: 4.9,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "陈晨",
    userName: "数据科学家",
    comment:
      "排版与动效克制不浮夸，把注意力留给内容和数据展示，是我喜欢的风格。",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "赵雪",
    userName: "IT 项目经理",
    comment:
      "和团队对齐方案时，按栏目分区演示非常高效，改版迭代节奏也好把控。",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "孙悦",
    userName: "运维工程师",
    comment:
      "多端访问稳定，上手成本低；常用入口聚合得好，日常推广与公司内部分发都省事。",
    rating: 4.9,
  },
];

export const TestimonialSection = () => {
  return (
    <section id="testimonials" className="container py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          客户评价
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
          听听他们的真实反馈
        </h2>
      </div>

      <Carousel
        opts={{
          align: "start",
        }}
        className="relative w-[80%] sm:w-[90%] lg:max-w-screen-xl mx-auto"
      >
        <CarouselContent>
          {reviewList.map((review) => (
            <CarouselItem
              key={review.name}
              className="md:basis-1/2 lg:basis-1/3"
            >
              <Card className="bg-muted/50 dark:bg-card">
                <CardContent className="pt-6 pb-0">
                  <div className="flex gap-1 pb-6">
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                    <Star className="size-4 fill-primary text-primary" />
                  </div>
                  {`"${review.comment}"`}
                </CardContent>

                <CardHeader>
                  <div className="flex flex-row items-center gap-4">
                    <Avatar>
                      <AvatarImage
                        src="https://avatars.githubusercontent.com/u/75042455?v=4"
                        alt="用户头像"
                      />
                      <AvatarFallback>SV</AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col">
                      <CardTitle className="text-lg">{review.name}</CardTitle>
                      <CardDescription>{review.userName}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>
  );
};
