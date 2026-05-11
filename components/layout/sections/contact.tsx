"use client";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Building2, Clock, Mail, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  firstName: z
    .string()
    .min(2, { message: "至少填写 2 个字符" })
    .max(255, { message: "最多 255 个字符" }),
  lastName: z
    .string()
    .min(2, { message: "至少填写 2 个字符" })
    .max(255, { message: "最多 255 个字符" }),
  email: z.string().email({ message: "请输入有效邮箱" }),
  subject: z
    .string()
    .min(2, { message: "至少填写 2 个字符" })
    .max(255, { message: "最多 255 个字符" }),
  message: z.string(),
});

export const ContactSection = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "网站开发",
      message: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const { firstName, lastName, email, subject, message } = values;
    console.log(values);

    const mailToLink = `mailto:leomirandadev@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`您好，我是 ${firstName} ${lastName}，邮箱：${email}。\n\n${message}`)}`;

    window.location.href = mailToLink;
  }

  return (
    <section id="contact" className="container py-24 sm:py-32">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="mb-4">
            <h2 className="text-lg text-primary mb-2 tracking-wider">
              联系
            </h2>

            <h2 className="text-3xl md:text-4xl font-bold">与我们沟通</h2>
          </div>
          <p className="mb-8 text-muted-foreground lg:w-5/6">
            无论是产品咨询、合作洽谈还是技术支持，填写表单或直接通过邮箱联系，我们会尽快回复。
          </p>

          <div className="flex flex-col gap-4">
            <div>
              <div className="flex gap-2 mb-1">
                <Building2 />
                <div className="font-bold">地址</div>
              </div>

              <div>常青街 742 号，斯普林菲尔德，伊利诺伊州 62704</div>
            </div>

            <div>
              <div className="flex gap-2 mb-1">
                <Phone />
                <div className="font-bold">电话</div>
              </div>

              <div>+1 (619) 123-4567</div>
            </div>

            <div>
              <div className="flex gap-2 mb-1">
                <Mail />
                <div className="font-bold">邮箱</div>
              </div>

              <div>leomirandadev@gmail.com</div>
            </div>

            <div>
              <div className="flex gap-2">
                <Clock />
                <div className="font-bold">营业时间</div>
              </div>

              <div>
                <div>周一至周五</div>
                <div>8:00 - 16:00</div>
              </div>
            </div>
          </div>
        </div>

        <Card className="bg-muted/60 dark:bg-card">
          <CardHeader className="text-primary text-2xl"> </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid w-full gap-4"
              >
                <div className="flex flex-col md:!flex-row gap-8">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>名</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：伟" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>姓</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：张" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>电子邮箱</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>主题</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择主题" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="网站开发">网站开发</SelectItem>
                            <SelectItem value="移动应用开发">
                              移动应用开发
                            </SelectItem>
                            <SelectItem value="Figma 设计">Figma 设计</SelectItem>
                            <SelectItem value="REST API">REST API</SelectItem>
                            <SelectItem value="全栈项目">全栈项目</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>留言</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={5}
                            placeholder="请描述您的需求或问题…"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button className="mt-4">发送消息</Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter></CardFooter>
        </Card>
      </section>
    </section>
  );
};
