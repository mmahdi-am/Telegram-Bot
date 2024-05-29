// import libraries
const { Telegraf, Markup } = require("telegraf");
const mysql = require("mysql2");
require("dotenv").config();
const findLikers = require("./likers.js");
const bioFinder = require("./bioFinder.js");
const likeToAuthenticate = require("./likeToAuthenticate.js");
const urlValidation = require("./urlValidation.js");
const REQUIRED_CAST_TO_AUTHENTICATE = "https://warpcast.com/rammus/0xe1d4b93d";
// connect to MySQL database
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_DOCKER_PORT,
});

let url = [];
let cast_url = [];
let likesNeeded = [];
let warpcastUsername = [];
let askToSendCast = [];
let userId = [];
let refCode = [];

// connect to db
db.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL database.");
});

// create tables if it doez not exists

// urls table
db.query(
  `
CREATE TABLE IF NOT EXISTS urls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(255) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  likes_needed INT
);
`,
  (err, results) => {
    if (err) throw err;
  }
);

// urls table
db.query(
  `
CREATE TABLE IF NOT EXISTS urls_archive (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(255) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  likes_needed INT
);
`,
  (err, results) => {
    if (err) throw err;
  }
);

// user_urls table
db.query(
  ` 
  CREATE TABLE IF NOT EXISTS user_urls (
    user_id BIGINT NOT NULL,
    url_id INT NOT NULL,
    liked BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, url_id),
    FOREIGN KEY (url_id) REFERENCES urls(id)
  )
`,
  (err, results) => {
    if (err) throw err;
  }
);

// user_points table
db.query(
  `
  CREATE TABLE IF NOT EXISTS user_points (
    user_id BIGINT PRIMARY KEY,
    points INT DEFAULT 0
  )
`,
  (err, results) => {
    if (err) throw err;
  }
);

// users table
db.query(
  `
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    warpcast_username VARCHAR(255) UNIQUE
  )
`,
  (err, results) => {
    if (err) throw err;
  }
);

// create telegraf instance
const bot = new Telegraf(process.env.BOT_TOKEN);

// create buttons
let buttons = [];

// updateLikesNeeded function
function updateLikesNeeded(urlId, urlOwnerId, ctx) {
  db.query(
    "UPDATE urls SET likes_needed = likes_needed - 1 WHERE id = ?",
    [urlId],
    (err, results) => {
      if (err)
        return console.log("خطا در به روز رسانی مقدار لایک مورد نیاز", err);

      db.query(
        "SELECT likes_needed FROM urls WHERE id = ?",
        [urlId],
        (err, results) => {
          if (err) return console.log("خطا در بررسی مقدار لایک مورد نیاز", err);
          if (results.length > 0 && results[0].likes_needed <= 0) {
            // ابتدا ارجاعات مربوطه را در جدول user_urls حذف کنید
            db.query(
              "DELETE FROM user_urls WHERE url_id = ?",
              [urlId],
              (err, results) => {
                if (err) return console.log("خطا در حذف", err);

                // سپس سطر مربوطه را در جدول urls حذف کنید
                db.query(
                  "DELETE FROM urls WHERE id = ?",
                  [urlId],
                  (err, results) => {
                    if (err) return console.log("خطا در حذف کست.", err);
                    ctx.telegram.sendMessage(
                      urlOwnerId,
                      "کست  شما به تعدادی که درخواست داده بودید  لایک شد و دیگر به سایر کاربران نمایش داده نمی‌شود."
                    );
                  }
                );
              }
            );
          }
        }
      );
    }
  );
}

// create invite link
bot.hears("🔗ساخت لینک دعوت🔗",(ctx)=>{
  userId[ctx.from.id] = ctx.from.id
  ctx.reply(
    `
    به ازای دعوت هر کاربر به ربات و ثبت نام موفق آن ها 20 امتیاز دریافت کنید .
لینک دعوت اختصاصی شما :
https://t.me/warpcastw3_bot?start=${userId[ctx.from.id]}
  `)
})

// send cast handler
bot.hears("📤 ارسال کست", (ctx) => {
  askToSendCast[ctx.from.id] = true;

  ctx.reply("لطفا لینک کست خود را ارسال کنید : ");
  bot.hears(/^https:\/\/warpcast\.com\//, async (ctx) => {
    url[ctx.from.id] = ctx.message.text;

    if (askToSendCast[ctx.from.id] && url[ctx.from.id]) {
      delete askToSendCast[ctx.from.id];

      const urlPattern = /^https:\/\/warpcast\.com\//;
      const isUrlValid = await urlValidation(url[ctx.from.id]);

      if (urlPattern.test(url[ctx.from.id]) && isUrlValid) {
        userId[ctx.from.id] = ctx.from.id;
        // Check for duplicate URL
        db.query(
          "SELECT * FROM urls_archive WHERE url = ?",
          [url[ctx.from.id]],
          (err, results) => {
            if (err) return ctx.reply("خطا در بررسی URL.");

            if (results.length > 0) {
              delete url[ctx.from.id];
              return ctx.reply(
                "⚠️ این کست قبلا ثبت شده است . لطفا بر روی دکمه ( ارسال کست ) کلیک کنید و یک کست دیگر را ارسال کنید ⚠️"
              );
            } else {
              // دریافت تعداد لایک مورد نیاز از کاربر
              ctx.reply("لطفا تعداد لایک مورد نیاز را وارد کنید:");
              bot.hears(/^\d+$/, (ctx) => {
                if (!url[ctx.from.id]) {
                  return ctx.reply("⚠️ دستور نامعتبر است ⚠️");
                }
                likesNeeded[ctx.from.id] = parseInt(ctx.message.text);

                // بررسی امتیاز کاربر
                db.query(
                  "SELECT points FROM user_points WHERE user_id = ?",
                  [userId[ctx.from.id]],
                  (err, results) => {
                    if (err) return ctx.reply("⚠️خطا در بررسی امتیاز.⚠️");

                    const userPoints =
                      results.length > 0 ? results[0].points : 0;
                    console.log("likes needed:", likesNeeded[ctx.from.id]);
                    console.log("userPoints:", userPoints);

                    if (likesNeeded[ctx.from.id] === 0) {
                      delete url[ctx.from.id];
                      delete likesNeeded[ctx.from.id];
                      return ctx.reply(
                        `⚠️شما نمی توانید 0 لایک درخواست کنید !⚠️`
                      );
                    }
                    if (likesNeeded[ctx.from.id] > userPoints) {
                      console.log("enter in ilkes needed condition");
                      delete url[ctx.from.id];
                      delete likesNeeded[ctx.from.id];
                      return ctx.reply(
                        `⚠️ شما نمی‌توانید تعداد لایک‌ بیشتر از امتیاز خود را درخواست کنید . امتیاز فعلی شما (${userPoints}) ⚠️ `
                      );
                    } else {
                      // store in urls archive
                      db.query(
                        "INSERT INTO urls_archive (url, user_id, likes_needed) VALUES (?, ?, ?)",
                        [
                          url[ctx.from.id],
                          userId[ctx.from.id],
                          likesNeeded[ctx.from.id],
                        ],
                        (err, results) => {
                          if (err) {
                            console.log("کست در آرشیو ذخیره نشد");
                          }
                          console.log("کست در آرشیو ذخیره شد");
                        }
                      );

                      // ذخیره اطلاعات در دیتابیس
                      db.query(
                        "INSERT INTO urls (url, user_id, likes_needed) VALUES (?, ?, ?)",
                        [
                          url[ctx.from.id],
                          userId[ctx.from.id],
                          likesNeeded[ctx.from.id],
                        ],
                        (err, results) => {
                          if (err) {
                            ctx.reply("⚠️خطا در ذخیره کست.⚠️");
                          }

                          db.query(
                            "UPDATE user_points SET points = points - ? WHERE user_id = ?",
                            [likesNeeded[ctx.from.id], userId[ctx.from.id]],
                            async (err, results) => {
                              if (err) {
                                console.log(
                                  "خطا در کم کردن امتیاز ارسال کننده کست.",
                                  err
                                );
                              } else {
                                console.log(likesNeeded[ctx.from.id]);
                                await ctx.reply(
                                  `[${
                                    likesNeeded[ctx.from.id]
                                  }] امتیاز بابت ذخیره کست از شما کسر شد`,
                                  buttons[ctx.from.id]
                                );
                                delete url[ctx.from.id];
                                delete likesNeeded[ctx.from.id];
                              }
                            }
                          );
                        }
                      );
                    }
                  }
                );
              });
            }
          }
        );
      } else {
        ctx.reply(
          "⚠️لینک وارد شده نامعتبر است . لطفا دوباره بر روی دکمه ارسال کست کلیک کنید و لینک صحیح را وارد کنید .⚠️"
        );
      }
    } else {
      delete askToSendCast[ctx.from.id];
      return ctx.reply("⚠️دستور ارسال شده نامعتبر است⚠️", buttons[ctx.from.id]);
    }
  });
});

// help handler
bot.hears("❓ راهنما", (ctx) => {
  return ctx.reply(
    `
 با استفاده از این ربات شما میتوانید به میزان دلخواه برای کست های خودتون لایک دریافت کنید . 

 نحوه کار با این ربات بسیار ساده است. در ابتدا شما ملزم به وارد کردن ID خود در برنامه Warpcast هستید.
 
 به محض ثبت نام شما در این ربات، شما ۵ امتیاز دریافت می‌کنید. 🌟
 
 با لایک کردن کست‌های سایر کاربران شما امتیاز دریافت می‌کنید. به این صورت که بعد از لایک کردن کست دیگران، سیستم بصورت هوشمند لایک شما را بررسی کرده و در صورت صحیح بودن آن به شما امتیاز می‌دهد. (هر لایک = یک امتیاز) 👍
 
 شما می‌توانید با وارد کردن آدرس کست و مشخص کردن تعداد لایک مورد نیاز خود به آسانی در مدت زمان بسیار کوتاهی به تعداد لایک مورد نظر خود برسید. ⏱️
 
 همچنین در هر لحظه با کلیک بر روی دکمه مشاهده امتیاز از امتیاز لحظه‌ای خود باخبر شوید. 📊

 برای دریافت امتیاز بیشتر میتوانید با دعوت سایر کاربران به ربات به ازای هر دعوت موفق 20 امتیاز دریافت کنید
 
 برای اطلاع از آخرین اخبار این پروژه می‌توانید در کانال زیر عضو شوید:
 @warpcast_f 📢`,
    buttons[ctx.from.id]
  );
});
// get points handler
bot.hears("🌟 دریافت امتیاز", (ctx) => {
  userId[ctx.from.id] = ctx.from.id;
  db.query(
    `
    SELECT url, id FROM urls
    WHERE user_id != ? AND id NOT IN (SELECT url_id FROM user_urls WHERE user_id = ?)
    ORDER BY RAND() LIMIT 1
  `,
    [userId[ctx.from.id], userId[ctx.from.id]],
    (err, urls_table_result) => {
      if (err) {
        return ctx.reply("⚠️خطا در بازیابی کست.⚠️");
      }
      if (urls_table_result.length > 0) {
        const urlId = urls_table_result[0].id;
        db.query(
          "INSERT INTO user_urls (user_id, url_id) VALUES (?, ?)",
          [userId[ctx.from.id], urlId],
          (err, results) => {
            if (err) {
              return ctx.reply("⚠️خطایی رخ داد⚠️");
            }
            ctx.reply(
              ` این یک کست تصادفی است . برای دریافت امتیاز پس از کلیک بر روی لینک زیر و لایک کردن این کست مجددا به ربات برگردید و بر روی دکمه [👍]  کلیک کنید تا صحت لایک بررسی شود 
${urls_table_result[0].url}`,
              Markup.inlineKeyboard([
                Markup.button.callback("👍", `like_${urlId}`),
              ])
            );
          }
        );
      } else {
        ctx.reply(
          "شما تمامی کست ها را مشاهده کرده اید . لطفا دقایقی دیگر مجدد امتحان کنید",
          buttons[ctx.from.id]
        );
      }
    }
  );
});

// like cast handler
bot.action(/^like_(\d+)$/, (ctx) => {
  userId[ctx.from.id] = ctx.from.id;
  const urlId = ctx.match[1];

  db.query(
    "SELECT user_id,url FROM urls WHERE id = ?",
    [urlId],
    (err, results) => {
      if (err) return ctx.reply("⚠️خطا در بررسی مالکیت کست.⚠️");
      if (results.length > 0) {
        const urlOwnerId = results[0].user_id;
        cast_url[ctx.from.id] = results[0].url;
        db.query(
          "SELECT liked FROM user_urls WHERE user_id = ? AND url_id = ?",
          [userId[ctx.from.id], urlId],
          (err, results) => {
            if (err) return ctx.reply("⚠️خطا در بررسی لایک.⚠️");
            if (results.length > 0 && results[0].liked) {
              return ctx.reply("⚠️شما قبلاً این کست را لایک کرده اید.⚠️");
            }
            db.query(
              "SELECT warpcast_username from users WHERE id = ?",
              [userId[ctx.from.id]],
              async (err, results) => {
                if (err)
                  return ctx.reply(
                    ": اکانت وارپکست یافت نشد لطفا ابتدا نام کاربری خود را وارد کنید",
                    { reply_markup: { force_reply: true } }
                  );
                if (results.length > 0 && results[0].warpcast_username) {
                  warpcast_username =
                    results[0].warpcast_username.toLowerCase();

                  list_of_likers = await findLikers(cast_url[ctx.from.id]);

                  const liker = list_of_likers.find(
                    (likers) => likers === warpcast_username
                  );
                  if (liker) {
                    db.query(
                      "UPDATE user_urls SET liked = TRUE WHERE user_id = ? AND url_id = ?",
                      [userId[ctx.from.id], urlId],
                      (err, results) => {
                        if (err)
                          return ctx.reply(
                            "⚠️خطا در به روز رسانی وضعیت پسندیدن.⚠️"
                          );
                        db.query(
                          "SELECT * FROM user_points WHERE user_id = ?",
                          [userId[ctx.from.id]],
                          (err, results) => {
                            if (err)
                              return ctx.reply("⚠️خطا در بررسی امتیاز.⚠️");
                            if (results.length > 0) {
                              db.query(
                                "UPDATE user_points SET points = points + 1 WHERE user_id = ?",
                                [userId[ctx.from.id]],
                                (err, results) => {
                                  if (err)
                                    return ctx.reply(
                                      "⚠️خطا در به روز رسانی امتیاز.⚠️"
                                    );

                                  ctx.telegram.sendMessage(
                                    urlOwnerId,
                                    "یک نفر کست شما را لایک کرد !"
                                  );
                                  // به روز رسانی likes_needed
                                  updateLikesNeeded(urlId, urlOwnerId, ctx);
                                }
                              );
                            }
                          }
                        );
                      }
                    );
                    return ctx.reply(
                      `کست توسط شما [ ${warpcast_username} ] لایک شد و معتبر است . یک امتیاز به شما اضافه شد .`
                    );
                  } else {
                    return ctx.reply(
                      `کست توسط شما لایک نشده است . لطفا مجددا بر روی لینک داده شده کلیک کنید و آن را لایک کنید . سپس به ربات برگردید و بر روی دکمه [👍] کلیک کنید تا صحت لایک شما بررسی شود`
                    );
                  }
                }
              }
            );
          }
        );
      } else {
        ctx.reply("⚠️خطا در بازیابی اطلاعات کست.⚠️");
      }
    }
  );
});

// show points handler
bot.hears("📊 نمایش امتیاز", (ctx) => {
  userId[ctx.from.id] = ctx.from.id;
  db.query(
    "SELECT points FROM user_points WHERE user_id = ?",
    [userId[ctx.from.id]],
    (err, results) => {
      if (err) return ctx.reply("⚠️خطا در بازیابی امتیاز.⚠️");
      if (results.length > 0) {
        ctx.reply(
          `امتیاز شما ( ${results[0].points} ) است . شما میتوانید با لایک کردن کست سایر کاربران یا دعوت دیگران به ربات امتیاز خود را افزایش دهید . `
        );
      } else {
        ctx.reply("⚠️شما هنوز امتیازی ندارید.⚠️");
      }
    }
  );
});

// start bot handler

bot.start((ctx) => {
  userId[ctx.from.id] = ctx.from.id;
  refCode[ctx.from.id] = ctx.payload;
  console.log(refCode[ctx.from.id]);

  db.query(
    "SELECT warpcast_username FROM users WHERE id = ?",
    [userId[ctx.from.id]],
    (err, results) => {
      if (err) {
        console.log("خطای سرور");
      }
      if (results.length > 0 && results[0].warpcast_username) {
        buttons[ctx.from.id] = Markup.keyboard([
          ["📤 ارسال کست", "🌟 دریافت امتیاز"],
          ["📊 نمایش امتیاز", "❓ راهنما"],
          [` 👤 نام کاربری شما [${results[0].warpcast_username}] 👤`],
          ["🔗ساخت لینک دعوت🔗"]
        ]).resize();

        ctx.reply(
          ` ${results[0].warpcast_username} خوش آمدید `,
          buttons[ctx.from.id]
        );
      } else {
        ctx.reply(          `
خوش آمدید!
لطفا نام کاربری اکانت وارپکست خود را وارد کنید :
            `,
          { reply_markup: { force_reply: true } }
        );
      }
    }
  );
});
bot.hears(/^(?!^\d+$).{1,20}$/, async (ctx) => {
  console.log('user has input username')
  warpcastUsername[ctx.from.id] = ctx.message.text.toLowerCase();
  userId[ctx.from.id] = ctx.from.id;

  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.text.includes("نام کاربری")
  ) {
    ctx.reply(
      `نام کاربری شما دریافت شد لطفا برای تکمیل احراز هویت خود بعد از  کلیک بر روی لینک زیر و لایک کردن آن به ربات بازگردید و بر روی دکمه [✅] کلیک کنید تا ثبت نام شما تکمیل شود 

${REQUIRED_CAST_TO_AUTHENTICATE}
              `,
      Markup.inlineKeyboard([
        Markup.button.callback(
          "✅",
          `complete_registration_${userId[ctx.from.id]}`
        ),
      ])
    );
  }
});



bot.action(/^complete_registration_(\d+)$/, async (ctx) => {
  userId[ctx.from.id] = ctx.from.id;

  const is_register_cast_like_liked_by_user = await likeToAuthenticate(
    warpcastUsername[ctx.from.id],
    REQUIRED_CAST_TO_AUTHENTICATE
  );

  if (is_register_cast_like_liked_by_user) {
    db.query(
      "SELECT warpcast_username FROM users WHERE id = ?",
      [userId[ctx.from.id]],
      (err, results) => {
        if (err) {
          console.log("خطای سرور");
        }
        if (results.length > 0 && results[0].warpcast_username) {
          ctx.reply(
            `شما قبلا با نام  ${results[0].warpcast_username} احراز خویت کرده اید و امکان تغییر آن وجود ندارد    `,
            buttons[ctx.from.id]
          );
        } else {
          db.query(
            "INSERT INTO users (id, warpcast_username) VALUES (?, ?)",
            [userId[ctx.from.id], warpcastUsername[ctx.from.id]],
            (err, results) => {
              if (err) {
                return ctx.reply(
                  `
                    کاربری با  نام کاربری ${
                      warpcastUsername[ctx.from.id]
                    } قبلا ثبت نام کرده است . لطفا یک نام کاربری دیگری را وارد کنید :
                    `,
                  { reply_markup: { force_reply: true } }
                );
              }
              buttons[ctx.from.id] = Markup.keyboard([
                ["📤 ارسال کست", "🌟 دریافت امتیاز"],
                ["📊 نمایش امتیاز", "❓ راهنما"],
                [`👤 نام کاربری شما [${warpcastUsername[ctx.from.id]}] 👤`],
                ["🔗ساخت لینک دعوت🔗"]
              ]).resize();
              ctx.reply(
                "ثبت نام شما تکمیل شد . میتوانید از امکانات ربات استفاده کنید .",
                buttons[ctx.from.id]
              );

              // افزودن امتیاز اولیه برای کاربر جدید
              db.query(
                "INSERT INTO user_points (user_id, points) VALUES (?, ?)",
                [userId[ctx.from.id], 5],
                (err, results) => {
                  if (err) {
                    return ctx.reply("⚠️خطا در افزودن امتیاز اولیه.⚠️");
                  }
                  ctx.reply(
                    "شما 5 امتیاز اولیه دریافت کرده‌اید!",
                    buttons[ctx.from.id]
                  );

                  // دادن امتیاز اضافه به کاربری که با لینک دعوت وارد شده است در صورتی که با لینک دعوت وارد شده باشد

                  if (
                    refCode[ctx.from.id] &&
                    refCode[ctx.from.id] !== userId[ctx.from.id]
                  ) {
                    db.query(
                      "UPDATE user_points SET points = points + ? WHERE user_id = ?",
                      [20, refCode[ctx.from.id]],
                      (err, results) => {
                        if (err) {
                          console.error(
                            "Error inserting new user points record"
                          );
                          return;
                        }
                        ctx.telegram.sendMessage(
                          refCode[ctx.from.id],
                          "یک نفر  با لینک دعوت شما در ربات ثبت نام کرد . 20 امتیاز به شما اضافه شد . "
                        );
                      }
                    );
                  }
                }
              );
            }
          );
        }
      }
    );
  } else {
    ctx.reply(
      `
         کست ارسال شده توسط [${
           warpcastUsername[ctx.from.id]
         } ] لایک نشده است  . برای تکمیل ثبت نام لازم است تا کست توسط شما لایک شود  

${REQUIRED_CAST_TO_AUTHENTICATE}
         `,
      Markup.inlineKeyboard([
        Markup.button.callback(
          "✅ بررسی مجدد صحت لایک ",
          `complete_registration_${userId[ctx.from.id]}`
        ),
      ])
    );
  }
});

// lunch bot
bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
