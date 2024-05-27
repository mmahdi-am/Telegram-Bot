const { Telegraf, Markup } = require('telegraf');
const mysql = require('mysql2');
require('dotenv').config()
// this function will give us list of users who liked given url in form of array
// example of expected output :  ["user1","user2","user3"]
const findLikers = require('./likers.js');
// find if given text exist in user bio
const bioFinder = require('./bioFinder.js'); 
// اتصال به پایگاه داده MySQL
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_DOCKER_PORT

});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database.');
});
 
// ایجاد جدول‌ها در صورت عدم وجود
db.query(`
  CREATE TABLE IF NOT EXISTS urls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    user_id BIGINT NOT NULL,
    likes_needed INT
  )
`, (err, results) => {
  if (err) throw err;
});  

db.query(` 
  CREATE TABLE IF NOT EXISTS user_urls (
    user_id BIGINT NOT NULL,
    url_id INT NOT NULL,
    liked BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, url_id),
    FOREIGN KEY (url_id) REFERENCES urls(id)
  )
`, (err, results) => {
  if (err) throw err;
});

db.query(`
  CREATE TABLE IF NOT EXISTS user_points (
    user_id BIGINT PRIMARY KEY,
    points INT DEFAULT 0
  )
`, (err, results) => {
  if (err) throw err;
});

db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    warpcast_username VARCHAR(255)
  )
`, (err, results) => {
  if (err) throw err;
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// ایجاد دکمه‌ها
const buttons = Markup.keyboard([
  ['ارسال کست', 'دریافت امتیاز'],
  ['نمایش امتیاز','راهنما']
]).resize();  
 
function updateLikesNeeded(urlId, urlOwnerId, ctx) {
  db.query('UPDATE urls SET likes_needed = likes_needed - 1 WHERE id = ?', [urlId], (err, results) => {
    if (err) return console.log('خطا در به روز رسانی مقدار لایک مورد نیاز', err);

    db.query('SELECT likes_needed FROM urls WHERE id = ?', [urlId], (err, results) => {
      if (err) return console.log('خطا در بررسی مقدار لایک مورد نیاز', err);
      if (results.length > 0 && results[0].likes_needed <= 0) {
        // ابتدا ارجاعات مربوطه را در جدول user_urls حذف کنید
        db.query('DELETE FROM user_urls WHERE url_id = ?', [urlId], (err, results) => {
          if (err) return console.log('خطا در حذف', err);
          
          // سپس سطر مربوطه را در جدول urls حذف کنید
          db.query('DELETE FROM urls WHERE id = ?', [urlId], (err, results) => {
            if (err) return console.log('خطا در حذف کست.', err);
            ctx.telegram.sendMessage(urlOwnerId, 'کست  شما به تعدادی که درخواست داده بودید  لایک شد و دیگر به سایر کاربران نمایش داده نمی‌شود.');
          });
        });
      }
    });
  });
} 
bot.settings({

})
// هندلر دکمه ارسال URL
bot.hears('ارسال کست', (ctx) => {
  console.log('enter to ersale url')
  ctx.reply('لطفا آدرس کست خود را ارسال کنید:');
  bot.hears(/^https:\/\/warpcast\.com\//, (ctx) => {
   
    const url = ctx.message.text;
    const urlPattern = /^https:\/\/warpcast\.com\//;
    console.log('entered url is :',url)
    if (urlPattern.test(url)) { 
      const userId = ctx.from.id;
      // دریافت تعداد لایک مورد نیاز از کاربر
      ctx.reply('لطفا تعداد لایک مورد نیاز را وارد کنید:');
      bot.hears(/^\d+$/, (ctx) => {
        const likesNeeded = parseInt(ctx.message.text);
    
        // بررسی امتیاز کاربر
        db.query('SELECT points FROM user_points WHERE user_id = ?', [userId], (err, results) => {
          if (err) return ctx.reply('خطا در بررسی امتیاز.');

          const userPoints = results.length > 0 ? results[0].points : 0;

          if (likesNeeded > userPoints) { 
            ctx.reply(` شما نمی‌توانید تعداد لایک‌ بیشتر از امتیاز خود را درخواست کنید . امتیاز فعلی شما (${userPoints}) `);
          } else {
            // ذخیره اطلاعات در دیتابیس
            db.query('INSERT INTO urls (url, user_id, likes_needed) VALUES (?, ?, ?)', [url, userId, likesNeeded], (err, results) => {
              if (err) {
                return ctx.reply('خطا در ذخیره کست.');
              }
              ctx.reply('کست  با موفقیت ذخیره شد!', buttons);
            });
          }
        });
      });
    } else {
      ctx.reply('لینک وارد شده نامعتبر است . لطفا لینک کست خود را در وارپکست ارسال کنید .');
    }
  });
});

bot.hears('راهنما', (ctx)=>{
 return ctx.reply(`
 یکی از بزرگترین مشکلات کاربران در وارپکست عدم وجود یک سیستم هوشمند است که به کاربران کمک کند تا به میزان دلخواه خودشان برای کست های خود لایک دریافت کنند! 🤖
 
 نحوه کار با این ربات بسیار ساده است. در ابتدا شما ملزم به وارد کردن ID خود در برنامه Warpcast هستید.
 
 به محض ثبت نام شما در این ربات، شما ۵ امتیاز دریافت می‌کنید. 🌟
 
 با لایک کردن کست‌های سایر کاربران شما امتیاز دریافت می‌کنید. به این صورت که بعد از لایک کردن کست دیگران، سیستم بصورت هوشمند لایک شما را بررسی کرده و در صورت صحیح بودن آن به شما امتیاز می‌دهد. (هر لایک = یک امتیاز) 👍
 
 شما می‌توانید با وارد کردن آدرس کست و مشخص کردن تعداد لایک مورد نیاز خود به آسانی در مدت زمان بسیار کوتاهی به تعداد لایک مورد نظر خود برسید. ⏱️
 
 همچنین در هر لحظه با کلیک بر روی دکمه مشاهده امتیاز از امتیاز لحظه‌ای خود باخبر شوید. 📊
 
 برای اطلاع از آخرین اخبار این پروژه می‌توانید در کانال زیر عضو شوید:
 @warpcast_f 📢`
,buttons);
}) 
// هندلر دکمه دریافت URL
bot.hears('دریافت امتیاز', (ctx) => {
  const userId = ctx.from.id;
  db.query(`
    SELECT url, id FROM urls
    WHERE user_id != ? AND id NOT IN (SELECT url_id FROM user_urls WHERE user_id = ?)
    ORDER BY RAND() LIMIT 1
  `, [userId, userId], (err, results) => {
    if (err) {
      return ctx.reply('خطا در بازیابی کست.');
    }
    if (results.length > 0) {
      const url = results[0].url;
      const urlId = results[0].id;
      db.query('INSERT INTO user_urls (user_id, url_id) VALUES (?, ?)', [userId, urlId], (err, results) => {
        if (err) {
          return ctx.reply('خطایی رخ داد');
        }
        ctx.reply(`. این یک کست تصادفی است . پس از کلیک بر روی لینک و لایک کردن این کست مجددا به ربات برگردید و بر روی دکمه [👍]  کلیک کنید تا صحت لایک بررسی شود    ${url}`, Markup.inlineKeyboard([
          Markup.button.callback('👍', `like_${urlId}`)
        ]));
      });
    } else {
      ctx.reply('هیچ کست جدیدی یافت نشد.', buttons);
    } 
  });
}); 

// هندلر دکمه Like
bot.action(/^like_(\d+)$/, (ctx) => {
  const userId = ctx.from.id;
  const urlId = ctx.match[1];
  console.log(ctx.match)
  
  db.query('SELECT user_id,url FROM urls WHERE id = ?', [urlId], (err, results) => {
    if (err) return ctx.reply('خطا در بررسی مالکیت کست.');
    if (results.length > 0) {
      const urlOwnerId = results[0].user_id;
      const url = results[0].url;
      db.query('SELECT liked FROM user_urls WHERE user_id = ? AND url_id = ?', [userId, urlId], (err, results) => {
        if (err) return ctx.reply('خطا در بررسی لایک.');
        if (results.length > 0 && results[0].liked) {
          return ctx.reply('شما قبلاً این کست را لایک کرده اید.');
        }
        db.query('SELECT warpcast_username from users WHERE id = ?',[userId],async (err,results)=>{
          // اینجا رو پر میکنم حالا
          if (err) return ctx.reply('اکانت وارپکست یافت نشد لطفا ابتدا کانت خود را وارد کنید');
          if (results.length > 0 && results[0].warpcast_username) {
            warpcast_username = results[0].warpcast_username.toLowerCase()    

             list_of_likers =  await findLikers(url)
             console.log(list_of_likers)
             console.log(findLikers)
             const liker = list_of_likers.find(likers=>likers===warpcast_username)
             if(liker){ 
              db.query('UPDATE user_urls SET liked = TRUE WHERE user_id = ? AND url_id = ?', [userId, urlId], (err, results) => {
                if (err) return ctx.reply('خطا در به روز رسانی وضعیت پسندیدن.');
                db.query('SELECT * FROM user_points WHERE user_id = ?', [userId], (err, results) => {
                  if (err) return ctx.reply('خطا در بررسی امتیاز.');
                  if (results.length > 0) {
                    db.query('UPDATE user_points SET points = points + 1 WHERE user_id = ?', [userId], (err, results) => {
                      if (err) return ctx.reply('خطا در به روز رسانی امتیاز.');
                      // ctx.reply(`  این کست (${url}) توسط شما [ ${warpcast_username} ] لایک شد و معتبر است . یک امتیاز به شما اضافه شد .`);
                      // کم کردن یک امتیاز از ارسال کننده URL
                      db.query('UPDATE user_points SET points = points - 1 WHERE user_id = ?', [urlOwnerId], (err, results) => {
                        if (err) console.log('خطا در کم کردن امتیاز ارسال کننده کست.', err);
                      });
                      // ارسال پیام به کاربر ارسال کننده URL
                      ctx.telegram.sendMessage(urlOwnerId, 'یک نفر کست شما را لایک کرد !');
                      // به روز رسانی likes_needed
                      updateLikesNeeded(urlId, urlOwnerId, ctx);
                    }); 
                  } else {  
                    db.query('INSERT INTO user_points (user_id, points) VALUES (?, 1)', [userId], (err, results) => {
                      if (err) return ctx.reply('خطا در اضافه کردن امتیاز.');
                      // ctx.reply(`کست توسط شما [ ${warpcast_username} ] لایک شد و معتبر است . یک امتیاز به شما اضافه شد .`);
                      // کم کردن یک امتیاز از ارسال کننده URL
                      db.query('UPDATE user_points SET points = points - 1 WHERE user_id = ?', [urlOwnerId], (err, results) => {
                        if (err) console.log('خطا در کم کردن امتیاز ارسال کننده کست.', err);
                      });
                      // ارسال پیام به کاربر ارسال کننده URL
                      ctx.telegram.sendMessage(urlOwnerId, 'یک نفر کست شما را لایک کرد !');
                      // به روز رسانی likes_needed
                      updateLikesNeeded(urlId, urlOwnerId, ctx);
                    });
                  }
                });  
              });
              return ctx.reply(`کست توسط شما [ ${warpcast_username} ] لایک شد و معتبر است . یک امتیاز به شما اضافه شد .`);

             }else{
              return ctx.reply(`لطفا بر روی لینک ارسال شده کلیک کنید و پس از لایک کردن آن به ربات برگردید و مجددا بر روی دکمه [👍] کلیک کنید تا صحت لایک بررسی شود  . کست توسط شما لایک نشده شده است`);
             }
             
          }    
        })  
    
      });
    } else {
      ctx.reply('خطا در بازیابی اطلاعات کست.');
    }
  });
});

// هندلر دکمه Show Points
bot.hears('نمایش امتیاز', (ctx) => {
  const userId = ctx.from.id;
  db.query('SELECT points FROM user_points WHERE user_id = ?', [userId], (err, results) => {
    if (err) return ctx.reply('خطا در بازیابی امتیاز.');
    if (results.length > 0) {
      ctx.reply(`امتیاز شما ( ${results[0].points} ) است . شما میتوانید با لایک کردن کست سایر کاربران امتیاز خود را افزایش دهید . `);
    } else {
      ctx.reply('شما هنوز امتیازی ندارید.');
    }
  }); 
}); 
    

  
 
bot.start((ctx) =>{ 
  const userId = ctx.from.id;
  ctx.reply( 
    `خوش آمدید! 
 در ابتدا نیاز است که احراز هویت انجام دهید . این کار برای این است که دیگر کاربران نتوانند خودشان را به جای شما جا بزنند . 
لطفا در Bio اکانت وارپکست خود متن زیر را اضافه کنید و سپس آی دی اکانت وارپکست خود را در پاسخ به این پیام وارد کنید تا هویت شما تایید شود :
     ${userId}
    `,{reply_markup: {force_reply: true}}
   
  
  )

      
}
);
 
bot.hears(/^(?!^\d+$).{1,20}$/, async (ctx) => {
  const warpcastUsername = ctx.message.text;
  const userId = ctx.from.id;
  console.log(userId)

  console.log('پاسخ به پیام شروع ربات دریافت شد')
  if (ctx.message.reply_to_message && ctx.message.reply_to_message.text.includes("خوش آمدید!")) {

    eligibility = await bioFinder(warpcastUsername,userId.toString())
    if(eligibility){

      db.query('SELECT warpcast_username FROM users WHERE id = ?', [userId], (err, results) => {


        if (err) {
  
  
           console.log('نام کاربری یافت نشد');
  
  
        }
        if (results.length > 0 && results[0].warpcast_username) {
  
  
  
          ctx.reply(`برای این اکانت قبلا نام کاربری  ${results[0].warpcast_username}   ثبت شده است  و دیگر قابل تغییر نیست`, buttons);
   
   
        } else {
  
  
  
            const warpcastUsername = ctx.message.text;
            db.query('INSERT INTO users (id, warpcast_username) VALUES (?, ?)', [userId, warpcastUsername], (err, results) => {
              if (err) {
                return ctx.reply('خطا در ذخیره نام کاربری warpcast.');
              }
              ctx.reply('هویت شما با موفقیت تایید شد . میتوانید از امکانات ربات استفاده کنید .', buttons);
               
              // افزودن امتیاز اولیه برای کاربر جدید
              db.query('INSERT INTO user_points (user_id, points) VALUES (?, ?) ON DUPLICATE KEY UPDATE points = points', [userId, 5], (err, results) => {
                if (err) {
                  return ctx.reply('خطا در افزودن امتیاز اولیه.');
                }
                ctx.reply('شما 5 امتیاز اولیه دریافت کرده‌اید!', buttons);
              });
            });  
  
  
  
        }
  
  
  
  
      });    
  
  
  


    }else{
      return ctx.reply(
        `
        هویت شما تایید نشد این اتفاق ممکن است به دو دلیل زیر رخ داده باشد :
        1 - نام کاربری خود راصحیح وارد نکرده اید
        2 - متن داده شده را در قسمت Bio اکانت وارپکست خود به درستی وارد نکرده اید .

        بعد از این موارد بر روی /start کلیک کنید 

        شروع دوباره :
        /start
        ` 



      
      );

    }
  


  













  }
});

 


// شروع ربات
bot.launch().then(() => {
  console.log('Bot is up and running');
}).catch((error) => {
  console.error('Failed to launch the bot', error);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
