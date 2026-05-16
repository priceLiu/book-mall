import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const CommunitySection = () => {
  return (
    <section id="community" className="py-12">
      <hr className="border-secondary" />
      <div className="container py-20 sm:py-20">
        <div className="lg:w-[60%] mx-auto">
          <Card className="bg-background border-none shadow-none text-center flex flex-col items-center justify-center">
            <CardHeader>
              <CardTitle className="text-3xl md:text-5xl font-bold leading-snug">
                准备好，写上你的需求，
                <span className="text-transparent pl-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                加入
                </span>
                。
              </CardTitle>
            </CardHeader>
            <CardContent className="lg:w-[80%] text-lg md:text-xl text-muted-foreground leading-relaxed">
              课程和工具需要您一起创造，您也可以使用我们的工具。
            </CardContent>
            <CardFooter className="flex flex-col items-center gap-3 pt-4">
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <Image
                  src="/wechat-community-qr.png"
                  alt="微信社群二维码"
                  width={260}
                  height={260}
                  priority={false}
                  className="h-[220px] w-[220px] md:h-[260px] md:w-[260px] rounded-md"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                微信扫一扫，加入社群
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
      <hr className="border-secondary" />
    </section>
  );
};
