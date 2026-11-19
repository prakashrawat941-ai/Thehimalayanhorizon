-- Starter content (admin can edit, unpublish or delete all of it from the admin portal).
-- No listings or reviews are invented: homestays, workspaces, village tours and cab rides
-- come only from real partners.

insert into public.site_settings (key, value) values
  ('brand',   '{"name":"The Himalayan Horizon","name_hi":"द हिमालयन होराइज़न","tagline":"Village tourism, homestays and slow travel in Uttarakhand","tagline_hi":"उत्तराखंड में गाँव, होमस्टे और सुकून भरी यात्रा"}'),
  ('contact', '{"phone":"","whatsapp":"","email":"","address":"Uttarakhand, India"}'),
  ('social',  '{"instagram":"","facebook":"","youtube":""}')
on conflict (key) do nothing;

insert into public.themes (slug, name, name_hi, summary, summary_hi, icon, color, position) values
  ('village-life',     'Village Life & Culture', 'गाँव और संस्कृति',   'Live with mountain families, eat local food, learn crafts and folk traditions.', 'पहाड़ी परिवारों के साथ रहिए, स्थानीय खाना, हस्तकला और लोक परंपराएँ।', '🏡', '#b5532b', 1),
  ('work-from-mountain','Work from Mountain',    'पहाड़ से काम',        'Fast Wi-Fi, quiet desks and long stays with a view.', 'तेज़ वाई-फ़ाई, शांत डेस्क और नज़ारे के साथ लंबा ठहराव।', '💻', '#2f6b4f', 2),
  ('treks-nature',     'Treks & Nature',         'ट्रेक और प्रकृति',     'Meadows, forests and easy-to-moderate Himalayan trails.', 'बुग्याल, जंगल और आसान से मध्यम हिमालयी ट्रेल।', '🥾', '#3b6e8f', 3),
  ('spiritual',        'Temples & Spiritual',    'मंदिर और आध्यात्म',    'Ancient temples, ghats and quiet ashrams of Devbhoomi.', 'देवभूमि के प्राचीन मंदिर, घाट और शांत आश्रम।', '🛕', '#8a5a9e', 4),
  ('local-food',       'Pahadi Food',            'पहाड़ी खाना',          'Mandua roti, bhatt ki churkani, kafuli and seasonal produce.', 'मंडुए की रोटी, भट्ट की चुड़कानी, काफ़ुली और मौसमी उपज।', '🍲', '#c08a1e', 5),
  ('wildlife-birding', 'Wildlife & Birding',     'वन्यजीव और पक्षी',     'Oak forests, sanctuaries and Himalayan birdlife.', 'बांज के जंगल, अभयारण्य और हिमालयी पक्षी।', '🦅', '#5d7a2e', 6)
on conflict (slug) do nothing;

insert into public.locations (slug, name, name_hi, kind, region, district, summary, summary_hi, theme_slugs, is_cab_point, is_featured, is_published, position) values
  -- Kumaon destinations
  ('nainital',   'Nainital',   'नैनीताल',   'destination', 'Kumaon', 'Nainital',  'Lake town and the usual gateway to the Kumaon hills.', 'झीलों का शहर और कुमाऊँ की पहाड़ियों का प्रवेश द्वार।', '{treks-nature}', true, false, true, 10),
  ('mukteshwar', 'Mukteshwar', 'मुक्तेश्वर', 'destination', 'Kumaon', 'Nainital',  'Orchards, an old Shiva temple and wide Himalayan views; good for long stays.', 'बगीचे, प्राचीन शिव मंदिर और हिमालय के नज़ारे; लंबे ठहराव के लिए बढ़िया।', '{work-from-mountain,village-life}', false, true, true, 11),
  ('almora',     'Almora',     'अल्मोड़ा',   'destination', 'Kumaon', 'Almora',    'Old cultural capital of Kumaon, known for its bazaar and sweets.', 'कुमाऊँ की पुरानी सांस्कृतिक राजधानी, बाज़ार और मिठाइयों के लिए मशहूर।', '{village-life,local-food}', true, false, true, 12),
  ('jageshwar',  'Jageshwar',  'जागेश्वर',  'destination', 'Kumaon', 'Almora',    'Cluster of ancient stone temples in a deodar forest.', 'देवदार के जंगल में प्राचीन पत्थर के मंदिरों का समूह।', '{spiritual}', false, false, true, 13),
  ('binsar',     'Binsar',     'बिनसर',     'destination', 'Kumaon', 'Almora',    'Wildlife sanctuary with oak forests and birding trails.', 'बांज के जंगल और पक्षी देखने वाले रास्तों वाला वन्यजीव अभयारण्य।', '{wildlife-birding,treks-nature}', false, false, true, 14),
  ('kausani',    'Kausani',    'कौसानी',    'destination', 'Kumaon', 'Bageshwar', 'Ridge village with sunrise views and tea gardens nearby.', 'सूर्योदय के नज़ारों वाला पहाड़ी गाँव, पास में चाय बागान।', '{village-life,treks-nature}', true, false, true, 15),
  ('munsiyari',  'Munsiyari',  'मुनस्यारी',  'destination', 'Kumaon', 'Pithoragarh','Mountain town facing the Panchachuli peaks; base for treks.', 'पंचाचूली चोटियों के सामने बसा पहाड़ी कस्बा; ट्रेक का बेस।', '{treks-nature,village-life}', true, true, true, 16),
  ('chaukori',   'Chaukori',   'चौकोड़ी',   'destination', 'Kumaon', 'Pithoragarh','Quiet tea-garden village with long Himalayan views.', 'चाय बागानों वाला शांत गाँव, हिमालय का लंबा नज़ारा।', '{village-life,work-from-mountain}', false, false, true, 17),
  -- Garhwal destinations
  ('rishikesh',  'Rishikesh',  'ऋषिकेश',    'destination', 'Garhwal', 'Dehradun', 'Yoga town on the Ganga and the starting point for Garhwal journeys.', 'गंगा किनारे योग नगरी और गढ़वाल यात्रा का शुरुआती पड़ाव।', '{spiritual}', true, false, true, 20),
  ('mussoorie',  'Mussoorie',  'मसूरी',     'destination', 'Garhwal', 'Dehradun', 'Classic hill station above Dehradun.', 'देहरादून के ऊपर बसा पुराना हिल स्टेशन।', '{treks-nature}', true, false, true, 21),
  ('chopta',     'Chopta',     'चोपता',     'destination', 'Garhwal', 'Rudraprayag','Meadows and forests below Tungnath temple.', 'तुंगनाथ मंदिर के नीचे बुग्याल और जंगल।', '{treks-nature,spiritual}', false, true, true, 22),
  ('auli',       'Auli',       'औली',       'destination', 'Garhwal', 'Chamoli',  'Slopes above Joshimath, known for snow in winter.', 'जोशीमठ के ऊपर ढलान, सर्दियों में बर्फ़ के लिए मशहूर।', '{treks-nature}', false, false, true, 23),
  ('lansdowne',  'Lansdowne',  'लैंसडाउन',  'destination', 'Garhwal', 'Pauri Garhwal','Quiet cantonment town with pine forests.', 'चीड़ के जंगलों वाला शांत छावनी कस्बा।', '{work-from-mountain,treks-nature}', false, false, true, 24),
  ('harsil',     'Harsil',     'हर्षिल',    'destination', 'Garhwal', 'Uttarkashi','Apple-orchard valley on the Bhagirathi.', 'भागीरथी किनारे सेब के बगीचों वाली घाटी।', '{village-life,treks-nature}', false, false, true, 25),
  -- Villages (main focus: village tourism)
  ('mana',       'Mana',       'माणा',      'village', 'Garhwal', 'Chamoli',    'Border village near Badrinath, home to the Bhotiya community and woollen weaving.', 'बद्रीनाथ के पास सीमांत गाँव, भोटिया समुदाय और ऊनी बुनाई का घर।', '{village-life,spiritual}', false, true, true, 30),
  ('sari',       'Sari',       'सारी',      'village', 'Garhwal', 'Rudraprayag','Base village for the Deoria Tal walk, with family-run homestays.', 'देवरिया ताल रास्ते का बेस गाँव, परिवारों के होमस्टे।', '{village-life,treks-nature}', false, true, true, 31),
  ('mukhba',     'Mukhba',     'मुखबा',     'village', 'Garhwal', 'Uttarkashi', 'Harsil valley village where Goddess Ganga is worshipped in winter.', 'हर्षिल घाटी का गाँव जहाँ सर्दियों में माँ गंगा की पूजा होती है।', '{village-life,spiritual}', false, false, true, 32),
  ('raithal',    'Raithal',    'रैथल',      'village', 'Garhwal', 'Uttarkashi', 'Village of old wooden houses at the start of the Dayara Bugyal trail.', 'पुराने लकड़ी के घरों वाला गाँव, दयारा बुग्याल रास्ते की शुरुआत।', '{village-life,treks-nature}', false, false, true, 33),
  ('khati',      'Khati',      'खाती',      'village', 'Kumaon',  'Bageshwar',  'Last village on the Pindari Glacier trail.', 'पिंडारी ग्लेशियर रास्ते का आख़िरी गाँव।', '{village-life,treks-nature}', false, false, true, 34),
  ('darkot',     'Darkot',     'दरकोट',     'village', 'Kumaon',  'Pithoragarh','Weavers'' village near Munsiyari known for hand-made woollens.', 'मुनस्यारी के पास बुनकरों का गाँव, हाथ से बने ऊनी कपड़ों के लिए जाना जाता है।', '{village-life}', false, false, true, 35),
  -- Transport hubs / towns used as cab pickup and drop points
  ('dehradun',   'Dehradun',   'देहरादून',  'transport_hub', 'Garhwal', 'Dehradun',  'Capital city; airport (Jolly Grant) and railway station.', 'राजधानी; जॉली ग्रांट हवाई अड्डा और रेलवे स्टेशन।', '{}', true, false, true, 40),
  ('haridwar',   'Haridwar',   'हरिद्वार',  'transport_hub', 'Garhwal', 'Haridwar',  'Railway hub on the Ganga.', 'गंगा किनारे बड़ा रेलवे स्टेशन।', '{spiritual}', true, false, true, 41),
  ('kathgodam',  'Kathgodam',  'काठगोदाम',  'transport_hub', 'Kumaon',  'Nainital',  'Railhead for the Kumaon hills.', 'कुमाऊँ की पहाड़ियों के लिए रेलवे स्टेशन।', '{}', true, false, true, 42),
  ('haldwani',   'Haldwani',   'हल्द्वानी', 'transport_hub', 'Kumaon',  'Nainital',  'Bus and road hub at the foot of the hills.', 'पहाड़ों की तलहटी में बस और सड़क का केंद्र।', '{}', true, false, true, 43),
  ('joshimath',  'Joshimath',  'जोशीमठ',    'town',          'Garhwal', 'Chamoli',   'Town on the road to Badrinath and Auli.', 'बद्रीनाथ और औली के रास्ते का कस्बा।', '{}', true, false, true, 44),
  ('uttarkashi', 'Uttarkashi', 'उत्तरकाशी', 'town',          'Garhwal', 'Uttarkashi','District town on the Bhagirathi.', 'भागीरथी किनारे ज़िला मुख्यालय।', '{}', true, false, true, 45),
  ('pithoragarh','Pithoragarh','पिथौरागढ़', 'town',          'Kumaon',  'Pithoragarh','District town in eastern Kumaon.', 'पूर्वी कुमाऊँ का ज़िला मुख्यालय।', '{}', true, false, true, 46)
on conflict (slug) do nothing;

insert into public.itineraries (slug, title, title_hi, summary, summary_hi, region, days_count, difficulty, budget_min, budget_max, best_season, theme_slugs, days, is_featured, is_published, position) values
('kumaon-village-trail', 'Kumaon Village Trail', 'कुमाऊँ गाँव यात्रा',
 'Five slow days through orchards, temple towns and ridge villages, staying with local families.',
 'बगीचों, मंदिर नगरों और पहाड़ी गाँवों से होकर पाँच सुकून भरे दिन, स्थानीय परिवारों के साथ ठहराव।',
 'Kumaon', 5, 'easy', 12000, 22000, 'March–June, September–November', '{village-life,local-food}',
 '[{"day":1,"title":"Kathgodam to Mukteshwar","title_hi":"काठगोदाम से मुक्तेश्वर","plan":"Drive up through Bhowali; evening walk to the Mukteshwar temple viewpoint.","plan_hi":"भवाली होते हुए ऊपर; शाम को मुक्तेश्वर मंदिर व्यू पॉइंट तक सैर।","location":"mukteshwar"},
   {"day":2,"title":"Orchards and a village lunch","title_hi":"बगीचे और गाँव का खाना","plan":"Walk through orchard villages; cook a Pahadi lunch with a host family.","plan_hi":"बगीचों वाले गाँवों में सैर; मेज़बान परिवार के साथ पहाड़ी खाना बनाइए।","location":"mukteshwar"},
   {"day":3,"title":"Almora and Jageshwar","title_hi":"अल्मोड़ा और जागेश्वर","plan":"Old bazaar of Almora, then the deodar-shaded temples of Jageshwar.","plan_hi":"अल्मोड़ा का पुराना बाज़ार, फिर देवदार से घिरे जागेश्वर मंदिर।","location":"jageshwar"},
   {"day":4,"title":"Binsar forest day","title_hi":"बिनसर जंगल का दिन","plan":"Birding walk in the oak forest; sunset at Zero Point.","plan_hi":"बांज के जंगल में पक्षी दर्शन; ज़ीरो पॉइंट पर सूर्यास्त।","location":"binsar"},
   {"day":5,"title":"Kausani sunrise","title_hi":"कौसानी का सूर्योदय","plan":"Sunrise over the peaks, tea garden visit, drive back.","plan_hi":"चोटियों पर सूर्योदय, चाय बागान, फिर वापसी।","location":"kausani"}]',
 true, true, 1),
('garhwal-sari-deoria-tal', 'Sari Village & Deoria Tal', 'सारी गाँव और देवरिया ताल',
 'Four days in Garhwal: a homestay in Sari, the walk to Deoria Tal and the meadows of Chopta.',
 'गढ़वाल में चार दिन: सारी गाँव में होमस्टे, देवरिया ताल की सैर और चोपता के बुग्याल।',
 'Garhwal', 4, 'moderate', 9000, 16000, 'April–June, September–November', '{village-life,treks-nature}',
 '[{"day":1,"title":"Rishikesh to Sari","title_hi":"ऋषिकेश से सारी","plan":"Long scenic drive along the Alaknanda and Mandakini; evening in the village.","plan_hi":"अलकनंदा और मंदाकिनी के किनारे लंबी यात्रा; शाम गाँव में।","location":"sari"},
   {"day":2,"title":"Deoria Tal","title_hi":"देवरिया ताल","plan":"Walk up to the lake, picnic lunch, back to the homestay.","plan_hi":"झील तक पैदल, पिकनिक लंच, होमस्टे वापसी।","location":"sari"},
   {"day":3,"title":"Chopta meadows","title_hi":"चोपता के बुग्याल","plan":"Drive to Chopta; optional walk towards Tungnath.","plan_hi":"चोपता तक; चाहें तो तुंगनाथ की ओर पैदल।","location":"chopta"},
   {"day":4,"title":"Return","title_hi":"वापसी","plan":"Drive back to Rishikesh.","plan_hi":"ऋषिकेश वापसी।","location":"rishikesh"}]',
 true, true, 2),
('work-from-mountain-mukteshwar', 'One Week Working from Mukteshwar', 'मुक्तेश्वर से एक हफ़्ता काम',
 'A week-long workation: weekday desk hours, evening walks and a weekend village trip.',
 'एक हफ़्ते का वर्केशन: हफ़्ते में डेस्क पर काम, शाम की सैर और वीकेंड पर गाँव की यात्रा।',
 'Kumaon', 7, 'easy', 14000, 30000, 'All year (cold in December–February)', '{work-from-mountain,village-life}',
 '[{"day":1,"title":"Arrive and settle in","title_hi":"पहुँचना और जमना","plan":"Check in, test the Wi-Fi, short walk.","plan_hi":"चेक-इन, वाई-फ़ाई जाँचिए, छोटी सैर।","location":"mukteshwar"},
   {"day":2,"title":"Work day","title_hi":"काम का दिन","plan":"Desk hours; sunset at the temple cliff.","plan_hi":"डेस्क पर काम; मंदिर की चट्टान पर सूर्यास्त।","location":"mukteshwar"},
   {"day":3,"title":"Work day","title_hi":"काम का दिन","plan":"Desk hours; orchard walk.","plan_hi":"डेस्क पर काम; बगीचे की सैर।","location":"mukteshwar"},
   {"day":4,"title":"Work day","title_hi":"काम का दिन","plan":"Desk hours; Pahadi dinner with the host.","plan_hi":"डेस्क पर काम; मेज़बान के साथ पहाड़ी खाना।","location":"mukteshwar"},
   {"day":5,"title":"Work day","title_hi":"काम का दिन","plan":"Desk hours; local market.","plan_hi":"डेस्क पर काम; स्थानीय बाज़ार।","location":"mukteshwar"},
   {"day":6,"title":"Village trip","title_hi":"गाँव की यात्रा","plan":"Day trip to a nearby village with a local guide.","plan_hi":"स्थानीय गाइड के साथ पास के गाँव की यात्रा।","location":"mukteshwar"},
   {"day":7,"title":"Slow morning and leave","title_hi":"आराम की सुबह और विदा","plan":"Breakfast with a view, drive to Kathgodam.","plan_hi":"नज़ारे के साथ नाश्ता, काठगोदाम की ओर।","location":"kathgodam"}]',
 true, true, 3),
('border-villages-mana', 'Joshimath, Auli & Mana Village', 'जोशीमठ, औली और माणा गाँव',
 'Four days up the Alaknanda valley to the border village of Mana and its weaving traditions.',
 'अलकनंदा घाटी में चार दिन, सीमांत गाँव माणा और उसकी बुनाई परंपरा तक।',
 'Garhwal', 4, 'easy', 10000, 18000, 'May–June, September–October', '{village-life,spiritual}',
 '[{"day":1,"title":"Rishikesh to Joshimath","title_hi":"ऋषिकेश से जोशीमठ","plan":"Long drive past the Prayags of the Alaknanda.","plan_hi":"अलकनंदा के प्रयागों से होकर लंबी यात्रा।","location":"joshimath"},
   {"day":2,"title":"Auli","title_hi":"औली","plan":"Morning at the Auli slopes and viewpoints.","plan_hi":"सुबह औली की ढलानें और व्यू पॉइंट।","location":"auli"},
   {"day":3,"title":"Mana village","title_hi":"माणा गाँव","plan":"Meet weavers, walk the village lanes, visit Badrinath (when the temple is open).","plan_hi":"बुनकरों से मिलिए, गाँव की गलियाँ, बद्रीनाथ दर्शन (मंदिर खुला हो तो)।","location":"mana"},
   {"day":4,"title":"Return","title_hi":"वापसी","plan":"Drive back down the valley.","plan_hi":"घाटी से वापसी।","location":"rishikesh"}]',
 false, true, 4)
on conflict (slug) do nothing;

insert into public.home_sections (kind, position, title, title_hi, subtitle, subtitle_hi, cta_label, cta_url) values
  ('hero',        1, 'Travel slow. Stay in the villages of Uttarakhand.', 'सुकून से घूमिए। उत्तराखंड के गाँवों में ठहरिए।',
                     'Plan your trip, live with mountain families, work with a Himalayan view and share a cab on your route.',
                     'अपनी यात्रा प्लान कीजिए, पहाड़ी परिवारों के साथ रहिए, हिमालय के नज़ारे के साथ काम कीजिए और अपने रूट पर कैब शेयर कीजिए।',
                     'Plan my trip', '#/plan'),
  ('themes',      2, 'Travel by what you love', 'अपनी पसंद से घूमिए', '', '', '', ''),
  ('villages',    3, 'Village tourism', 'विलेज टूरिज्म', 'Walk the lanes, share a meal and learn the culture of the hills from the people who live there.', 'गाँव की गलियों में घूमिए, साथ खाना खाइए और पहाड़ की संस्कृति वहीं के लोगों से जानिए।', 'Explore villages', '#/villages'),
  ('itineraries', 4, 'Ready-made itineraries', 'तैयार यात्रा प्लान', 'Start from a plan, then make it your own.', 'किसी प्लान से शुरू कीजिए, फिर उसे अपने हिसाब से बदलिए।', 'All itineraries', '#/itineraries'),
  ('destinations',5, 'Places to go', 'घूमने की जगहें', '', '', 'Explore', '#/explore'),
  ('stays',       6, 'Homestays', 'होमस्टे', 'Rooms in real mountain homes, booked on request.', 'असली पहाड़ी घरों में कमरे, रिक्वेस्ट से बुकिंग।', 'See homestays', '#/stays'),
  ('workspaces',  7, 'Work from Mountain', 'पहाड़ से काम', 'Desks with Wi-Fi and power backup, in the hills.', 'पहाड़ों में वाई-फ़ाई और पावर बैकअप वाली डेस्क।', 'Find a workspace', '#/workspaces'),
  ('cabs',        8, 'Instant cab on your route', 'आपके रूट पर इंस्टेंट कैब', 'Drivers publish rides; you book a seat.', 'ड्राइवर राइड डालते हैं, आप सीट बुक करते हैं।', 'Find a ride', '#/cabs'),
  ('partner_cta', 9, 'Own a homestay, a cab or a workspace?', 'आपका होमस्टे, कैब या वर्कस्पेस है?', 'Join as a partner and reach travellers.', 'पार्टनर बनिए और यात्रियों तक पहुँचिए।', 'Become a partner', '#/partner/join');
