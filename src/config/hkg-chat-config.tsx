const CHAT = [
  {
    idx: 0,
    message: <p>hii, is this still avail? :3</p>,
    role: "buyer",
    path: 1,
  },
  {
        idx: 1,
    message: (
      <div>
        <p>
          Made An Offer&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          &nbsp;&nbsp;
        </p>{" "}
        <b>MY YELLOW SHAWL</b>
      </div>
    ),
    role: "buyer",
    path: 1,
  },
  {
    idx: 2,
    message: <p>yes</p>,
    role: "seller",
    path: 1,
  },
  {
    idx: 3,
    message: (
      <div>
        <p>
          Accepted Offer&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          &nbsp;&nbsp;
        </p>{" "}
        <b>YOUR YELLOW SHAWL</b>
      </div>
    ),
    role: "seller",
    path: 1,
  },
  {
    idx: 4,
    message: <p>im available around Temple St Jordan now</p>,
    role: "seller",
    path: 1,
    img: "https://upload.wikimedia.org/wikipedia/commons/a/a6/GateOfTempleInHongKong.jpg"
  },
  {
    idx: 5,
    message: <p>perfect! what a coincidence! maybe we&apos;re match-made in heaven since im here too ^^</p>,
    role: "buyer",
    path: 1,
  },
  {
    idx: 6,
    message: <p>hey look at this !</p>,
    role: "seller",
    path: 2,
    img: "/images/1.JPG",
  },
  {
    idx: 7,
    message: <p>omg my fav Kuromi ૮ ˶ᵔ ᵕ ᵔ˶ ა im walking to u ~</p>,
    role: "buyer",
    path: 2,
  },
  {
    idx: 100,
    message: <p>sorry give me a few sec. I need to chill next to the ice cream machine cuz Y is HK still hot in October?!</p>,
    role: "buyer",
    path: 2,
  },
  {
      idx: 8,
    message: <p>no rush! speaking about chilling stuff... saw some funny fridge magnets..</p>,
    role: "seller",
    path: 3,
    img: "/images/3.JPG",
  },
  {
    idx: 9,
    message: <p>haha i need to get the CRAZY GUY (i hate men)</p>,
    role: "buyer",
    path: 3,
  },
  {
    idx: 10,
    message: <p>oops same gurl..</p>,
    role: "buyer",
    path: 3,
  },
  {
    idx: 11,
    message: <p>i&apos;m around a karaoke place</p>,
    role: "seller",
    path: 4,
    img: "/images/29.JPG",
  },
  {
    idx: 12,
    message: <p>do u think the pimp is paying them fair & square?</p>,
    role: "buyer",
    path: 4,
  },
  {
    idx: 13,
    message: <p>thats a good question that our society needs to address tbh</p>,
    role: "seller",
    path: 4,
  },
  {
    idx: 14,
    message: <p>now, i&apos;m just appreciating these kirbies</p>,
    role: "seller",
    path: 5,
    img: "/images/5.JPG",
  },
  {
    idx: 15,
    message: <p>omg! i also play... why are we so attracted to small squishy things with big eyes and big butt... i always wonder</p>,
    role: "buyer",
    path: 5,
  },
  {
    idx: 16,
    message: <p>haha maybe thats just you!! (no jk i also do too, kinda disgusted at myself now)</p>,
    role: "seller",
    path: 5,
  },
  {
    idx: 17,
    message: <p>i guess thats just our human nature :/ should we to blame the nature for our profanities tho?</p>,
    role: "buyer",
    path: 6,
  },
  {
    idx: 18,
    message: <p>but that makes us no difference from animals that have no &quot;freedom&quot; to stand by their morality right?</p>,
    role: "seller",
    path: 6,
  },
  {
    idx: 19,
    message: <p>as if there&apos;s even such thing as freedom! ugh!</p>,
    role: "buyer",
    path: 6,
  },
  // {
  //   idx: 20,
  //   message: <p>these deep thoughts are making a small gal like me hungry</p>,
  //   role: "buyer",
  //   path: 7,
  // },
  //   {
  //     idx: 21,
  //   message: <p>ur mother nature instinct calls</p>,
  //   role: "seller",
  //   path: 7,
  // },
  //   {
  //     idx: 22,
  //   message: <p>i thot these tanghulu are only in Korea (or is it??) globalization feels so real</p>,
  //   role: "buyer",
  //   path: 7,
  //   img: "/images/24.JPG"
  // },
  // {
  //   idx: 23,
  //   message: <p>no silly! its from the northern China. but what does geographic separation even mean when people were colonizing each other?</p>,
  //   role: "seller",
  //   path: 8,
  // },
  //   {
  //   idx: 24,
  //   message: <p>just now you&apos;re mentioning about the idea of freedom. and here i saw what seems to be Chinese paintings, but they look like they have Western influence</p>,
  //   role: "buyer",
  //   path: 9,
  //   img: "/images/23.JPG"
  // },
// {
//     idx: 25,
//     message: <p>yep ure definitely looking at a fake Yue Minjun. yah clearly the works along that period was influenced by Western art movements like Dada, Surrealism, a lot of irony too. Id say this absurdism may also be linked with Western philosophers too hmm</p>,
//     role: "seller",
//     path: 9,
//   },

  {
    idx: 24,
    message: <p>just now you&apos;re mentioning about the idea of freedom. i saw what seems to be Chinese paintings here, the laughing faces really caught my attention. the collectivity of the laughter, it just screams irony, as if they know they can&apos;t buy their freedom and laughter is the only liberty that they had.</p>,
    role: "buyer",
    path: 6,
    img: "/images/23.JPG"
  },
{
    idx: 25,
    message: <p>yep ure definitely looking at a fake Yue Minjun.</p>,
    role: "seller",
    path: 6,
  },
  {
    idx: 25,
    message: <p>ur feelings are valid but might be too farfetched from the original intention in the painting itself. the work is indeed part of the Cynical Realism movement in China that critiques the political ideologies tho uhhh</p>,
    role: "seller",
    path: 6,
  },

  {
    idx: 26,
    message: <p>i see.. its also funny to see it here in this local market as a counterfeit. consumerism at its best. prying on the locals (and internationals perhaps) to buy the fake of their own local crafts!</p>,
    role: "buyer",
    path: 6,
  },
{
  idx: 27,
    message: <p>well Yue Minjun isnt from Hong Kong tho..</p>,
    role: "seller",
    path: 6,
  },
  {
    idx: 28,
    message: <p>sshh!</p>,
    role: "buyer",
    path: 6,
  },
    {
    idx: 31,
    message: <p>i feel overwhelmed with this sensory overload</p>,
    role: "seller",
    path: 7,
    img: "/image/6.JPG"
  },

  {
    idx: 31,
    message: <p>look at these mini cameras (˶˃ ᵕ ˂˶) .ᐟ.ᐟ</p>,
    role: "buyer",
    path: 7,
    img: "/image/6.JPG"
  },
  {
    idx: 32,
    message: <p>i wanna go back to those days where all things serve its own separate functions instead of being glued to this piece of a phone device. camera just for camera, phone just for phone, etc. i think we were less likely to be overwhelmed back then, wdyt?</p>,
    role: "buyer",
    path: 7,
  },
  {
    idx: 33,
    message: <p>then what if carousell was never invented? how am i able to meet you?</p>,
    role: "seller",
    path: 7,
  },
  {
    idx: 34,
    message: <p>idk? have u ever heard of the hyper time and space?</p>,
    role: "buyer",
    path: 8,
  },
  {
    idx: 34,
    message: <p>sorry what?</p>,
    role: "seller",
    path: 8,
  },
    {
    idx: 34,
    message: <p>imagine that it looks like this slinky toy. it stretches back and forth, the spirals occupy multiple places at once.</p>,
    role: "buyer",
    path: 8,
        img: "/images/18.JPG"
  },
    {
    idx: 34,
    message: <p>and ur point is..?</p>,
    role: "seller",
    path: 8,
  },
    {
    idx: 34,
    message: <p>maybe carousell can exist in another universe whereas in another we&apos;re perfectly fine without any advancement in technology</p>,
    role: "buyer",
    path: 8,
  },
    {
    idx: 34,
    message: <p>i believe ure again being too farfetched</p>,
    role: "seller",
    path: 8,
  },
  {
    idx: 35,
    message: <p>sorry! i guess im just as distracted and overwhelmed as u. coming to u soon</p>,
    role: "buyer",
    path: 9,
  },
  {
    idx: 36,
    message: <p>dont get distracted. we&apos;re still exchanging right?</p>,
    role: "seller",
    path: 9,
  },
  {
    idx: 37,
    message: <p>yes, dont worry! im in luv with ur shawl. its just.. everything is so tempting!</p>,
    role: "buyer",
    path: 10,
  },
  {
    idx: 38,
    message: <p>just.look.at.this.MIU MIU!</p>,
    role: "buyer",
    path: 11,
        img: "/images/17.JPG"
  },
  {
    idx: 39,
    message: <p>come on. its fake. my shawl is real.</p>,
    role: "seller",
    path: 11,
  },
  {
    idx: 40,
    message: <p>so what if its fake? we&apos;re all just buying into the experience, the persona, the status that the product gives you - and not the product itself!</p>,
    role: "buyer",
    path: 11,
  },
    {
    idx: 39,
    message: <p>...</p>,
    role: "seller",
    path: 11,
  },
    {
    idx: 43,
    message: <p>hello can u pick up my call? u can rant later after u meet me</p>,
    role: "seller",
    path: 13,
  },
    {
    idx: 43,
    message: <p>oh sorry</p>,
    role: "buyer",
    path: 13,
  },
  {
    idx: 57,
    message: <p>distracted again by these cute chibi stickers. i wanna dress up just like them!</p>,
    role: "buyer",
    path: 14,
    img: "/images/14.JPG"
  },
  {
    idx: 58,
    message: <p>your style defines you</p>,
    role: "seller",
    path: 14,
  },
  {
    idx: 59,
    message: <p>not really. i am more than my looks.</p>,
    role: "buyer",
    path: 14,
  },
  {
    idx: 60,
    message: <p>you think? for me, i dont think ill never truly know myself. my look becomes a helper to understand my inner desire</p>,
    role: "seller",
    path: 14,
  },
  {
    idx: 61,
    message: <p>fair. but it doenst have to be that deep. i just wanna be cute.</p>,
    role: "buyer",
    path: 14,
    img: "/images/15.JPG"
  },
  {
    idx: 62,
    message: <p>exactly. YOLO. just have fun. noone understands life anw.</p>,
    role: "seller",
    path: 14,
  },

  {
    idx: 50,
    message: <p>ur quote is so 2010 lol which kinda same vibe with this  dreamcatcher thing</p>,
    role: "buyer",
    path: 16,
    img:"/images/12.JPG"
  },
  {
    idx: 51,
    message: <p>reminds me of middle school days trend lol</p>,
    role: "seller",
    path: 16,
  },
  {
    idx: 52,
    message: <p>time flies huh</p>,
    role: "buyer",
    path: 16,
  },
  {
    idx: 53,
    message: <p>but trend repeats itself right</p>,
    role: "seller",
    path: 16,
  },
  {
    idx: 54,
    message: <p>i believe back then it was much more original cuz how can u repeat the trend cycle if u dont have any info about it? i mean back then we dont have internet or as much as communication</p>,
    role: "buyer",
    path: 16,
  },
  {
    idx: 56,
    message: <p>we are just creatures that have instict to be fabulous and always wanna be in style</p>,
    role: "seller",
    path: 16,
  },

  {
    idx: 43,
    message: <p>oh wait i think i saw you. ur hair is so orange lol</p>,
    role: "seller",
    path: 17,
  },
  {
    idx: 44,
    message: <p>haha yes thats me!</p>,
    role: "buyer",
    path: 17,
  },
  {
    idx: 45,
    message: <p>ya so thats u confirm babygirl808</p>,
    role: "seller",
    path: 18,
  },
    {
    idx: 45,
    message: <p>confirmed. confirm ure the girl in pink, 09sweetheart09?</p>,
    role: "buyer",
    path: 18,
  },
    {
    idx: 45,
    message: <p>positive.</p>,
    role: "seller",
    path: 18,
  },

  {
    idx: 46,
    message: <p>omg hi! the shawl on you!</p>,
    role: "buyer",
    path: 19,
  },
  {
    idx: 47,
    message: <p>the shawl on you too!</p>,
    role: "seller",
    path: 19,
  },
  {
    idx: 48,
    message: <p>nice doing transaction with you. have a great day ahead!</p>,
    role: "buyer",
    path: 20,
  },
  {
    idx: 49,
    message: <p>same goes to you!</p>,
    role: "seller",
    path: 20,
  },
    {
    idx: 49,
    message: <p>omg i saw the dreamcatcher u mentioned</p>,
    role: "seller",
    path: 21,
  },
    {
    idx: 49,
    message: <p>back then it was a trend to catch ur dreams </p>,
    role: "buyer",
    path: 21,
  },
    {
    idx: 49,
    message: <p>my dream is to #accelerate my life and leave this place</p>,
    role: "seller",
    path: 22,
  },
    {
    idx: 49,
    message: <p>wdym? why are u hating sm?</p>,
    role: "buyer",
    path: 22,
  },
    {
    idx: 49,
    message: <p>no im not hating! im just frustrated on why there is geographical border. why do we need to be defined by national identities??</p>,
    role: "seller",
    path: 22,
  },
    {
    idx: 49,
    message: <p>some people escape to anime as an alternate identity thats universal and welcoming to everyone</p>,
    role: "buyer",
    path: 23,
  },
    {
    idx: 49,
    message: <p>just as you said that.. im here with the anime sticker you sent me. they are super cute</p>,
    role: "seller",
    path: 23,
  },

  {
        idx: 77,
    message: <p>they are obviously thriving in this sensory overload environment! i just wish theres some shades to filter out all these nonsense from my life. </p>,
    role: "seller",
    path: 25,
    img: "/images/15.JPG"
  },
    {
        idx: 77,
    message: <p>u look funny when ure complaining </p>,
    role: "buyer",
    path: 25,
  },
  {
    idx: 78,
    message: <p>thanks</p>,
    role: "seller",
    path: 26,
  },
  {
    idx: 41,
    message: <p>see these kind of jaded bracelets. where are they from? who own their ownership? who is the first inventor of these bracelet design? whats the point of buying into specific brand then?</p>,
    role: "seller",
    path: 26,
    img: "/images/16.JPG"
  },
  {
    idx: 42,
    message: <p>yeah i agree that the jade bracelets, though most associated with China, it also belongs to other culture like Central America. but, the idea of branding is invented much more later than the actual product and design.</p>,
    role: "buyer",
    path: 26,
  },
      {
    idx: 42,
    message: <p>a lot, if not everything in this world that falls into this limbo category.</p>,
    role: "seller",
    path: 26,
  },

  {
    idx: 42,
    message: <p>yeah, similar big question with this object origin</p>,
    role: "buyer",
    path: 26,
    img: "/images/11.JPG"
  },
    {
          idx: 79,
    message: <p>this miu miu bag has the same color as the jade bracelet. but why does it a different perceived value? why is it seen as more modern and why is the jaded bracelet not?</p>,
    role: "seller",
    path: 27,
    img: "/image/21.JPG"
  },
    {
          idx: 79,
    message: <p>ure clearly trying to see an object from one lens...</p>,
    role: "buyer",
    path: 27,
  },
  {
          idx: 79,
    message: <p>why not?</p>,
    role: "seller",
    path: 28,
    img: "/image/21.JPG"
  },
  {
    idx: 79,
    message: <p>didnt u mention earlier about the hyper time and space? maybe we can make every single thought process legitimate in an infinite time and space.</p>,
    role: "seller",
    path: 29,
    img: "/image/21.JPG"
  },
  {
    idx: 79,
    message: <p>what would you want to discover if you are able to travel in hyper time and space?</p>,
    role: "buyer",
    path: 29,
  },
    {
    idx: 79,
    message: <p>imagine with this bag lol</p>,
    role: "buyer",
    path: 29,
    img: "/images/13.JPG"
  },
    {
    idx: 79,
    message: <p>id like to go meet this particular man</p>,
    role: "seller",
    path: 30,
  },

  {
        idx: 74,
    message: <p>im wondering what he would think of this market.</p>,
    role: "buyer",
    path: 30,
  },
  {
        idx: 75,
    message: <p>at first i wouldnt think this kind of local market is capitalist since im hoping that the profit will return to the locals</p>,
    role: "seller",
    path: 30,
  },
  {
        idx: 76,
    message: <p>yah but its not simple as that. these sellers, they liaise with other distritors etc, forming a system that once a part is removed, it may easily destroy everything</p>,
    role: "buyer",
    path: 30,
  },
  {
        idx: 80,
    message: <p>if only cameras can also return back the history, before everything is destroyed.</p>,
    role: "seller",
    path: 31,
  },
    {
        idx: 87,
    message: <p>if everything in this world is made by rubber and squishy material, we would have less destruction.</p>,
    role: "buyer",
    path: 31,
  },
    {
        idx: 87,
    message: <p>im super attracted to squishy.</p>,
    role: "seller",
    path: 32,
  },
  {
      idx: 88,
    message: <p>will u be canceled if ure an influencer and then u post this kind of pic online?</p>,
    role: "buyer",
    path: 32,
        img:"/images/8.JPG"
  },
  {
      idx: 88,
    message: <p>likely</p>,
    role: "seller",
    path: 32,
  },
  {
      idx: 89,
    message: <p>oh im actually an aspiring model and influencer. so i should carefully curate what i publish like what u said.</p>,
    role: "buyer",
    path: 32,
  },
  {
        idx: 90,
    message: <p>this bag will fit my persona perfectly and safely without any netizen cancellations uwu</p>,
    role: "buyer",
    path: 33,
    img: "/images/28.JPG"
  },
  {
        idx: 91,
    message: <p>its demure, its dainty, its harmless! its a girl!</p>,
    role: "seller",
    path: 33,
  },
  {
        idx: 90,
    message: <p>exactly. being a girl is being a capital.</p>,
    role: "buyer",
    path: 33,
  },
  {
        idx: 99,
    message: <p>these deep thoughts are making a small gal like me hungry</p>,
    role: "seller",
    path: 34,
        img: "/images/24.JPG"
  },
    {
          idx: 100,
    message: <p>ur mother nature instinct calls</p>,
    role: "buyer",
    path: 34,
  },
    {
          idx: 101,
    message: <p>i thot these tanghulus only exist in Korea (or is it??) globalization feels so real</p>,
    role: "buyer",
    path: 34,
  },
  {
        idx: 102,
    message: <p>no silly! its from the northern China. but what does geographic separation even mean when people were colonizing each other?</p>,
    role: "seller",
    path: 34,
  },

  {
    idx: 103,
    message: <p>i&apos;m around the karaoke place. i think girls are colonized here.</p>,
    role: "buyer",
    path: 35,
    img: "/images/4.JPG",
  },
  {
        idx: 106,
    message: <p>may this discussion liberates us girls as we leave Temple Street</p>,
    role: "seller",
    path: 37,
  },
  {
        idx: 107,
    message: <p>may this discussion stays in this Temple Street and may us girls be liberated.</p>,
    role: "buyer",
    path: 38,
  },
];


export default CHAT;