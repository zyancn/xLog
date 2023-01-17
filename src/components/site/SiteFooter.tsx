import { APP_NAME, SITE_URL } from "~/lib/env"
import { UniLink } from "../ui/UniLink"
import { Profile, Note } from "~/lib/types"
import Script from "next/script"
import Image from "next/image"

export const SiteFooter: React.FC<{
  site?: Profile | null
  page?: Note | null
}> = ({ site, page }) => {
  return (
    <>
      <style>
.linklist{border:1px solid #eee;padding:10px 10px 0;border-radius:6px;margin:0px auto 10px;background:#fff;}
.linklist .name{font-size:16px;border-bottom:1px solid #eee;padding:0 0 10px;margin-bottom:10px;}
.linklist ul li{display:inline-block;margin:0 10px 10px 0}
.linklist ul li a{font-size:14px;}
.linklist ul li a:hover{text-decoration:underline}
.pagewh{width: 900px;}
</style>
<div class="linklist pagewh">
 <div class="name">友情链接</div>
 <ul>	<li><a href="https://emlog.net" title="emlog官方主页" target="_blank">emlog</a></li>	<li><a href="http://www.ccgxk.com/" title="" target="_blank">独元殇</a></li>	<li><a href="https://lanye.org" title="" target="_blank">蓝叶</a></li>	<li><a href="https://kule66.com" title="" target="_blank">酷乐博客</a></li>	<li><a href="https://www.lanli.net/" title="" target="_blank">蓝立网</a></li>	<li><a href="https://www.zhanzhanghao.cn/" title="" target="_blank">站长号</a></li>	<li><a href="https://nhxsk.com/" title="" target="_blank">坏猫</a></li>	<li><a href="https://www.luyuz.cn" title="" target="_blank">路羽博客</a></li>	<li><a href="https://xitongo.com/" title="" target="_blank">系统哦</a></li>	<li><a href="https://www.hao-hacker.com" title="" target="_blank">好黑客</a></li>	<li><a href="https://riced.cn/" title="" target="_blank">会飞的鱼</a></li>	<li><a href="https://www.sgtms.com" title="" target="_blank">SGTMS</a></li>	<li><a href="https://feifanblog.com/" title="" target="_blank">非凡博客</a></li>	<li><a href="https://www.4241.cn/" title="" target="_blank">阿影资源网</a></li>	<li><a href="https://blog.yanyulun.com/" title="" target="_blank">晏裕伦博客</a></li></ul>
</div>
      <footer className="text-zinc-500 border-t">
        <div className="max-w-screen-md mx-auto px-5 py-10 text-xs">
          <p className="font-medium text-base">
            &copy;{" "}
            <UniLink href="/" className="hover:text-accent">
              {site?.username}
            </UniLink>{" "}
            · Powered by{" "}
            <UniLink
              href={SITE_URL}
              className="hover:text-accent inline-flex items-center align-text-top ml-1"
            >
              <Image
                alt={APP_NAME}
                src={`${SITE_URL}/logo.svg`}
                width={20}
                height={20}
              />
            </UniLink>
          </p>
        </div>
      </footer>
      {site?.ga && (
        <div className="xlog-google-analytics">
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=G-${site.ga}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-${site.ga}');
          `}
          </Script>
        </div>
      )}
    </>
  )
}
