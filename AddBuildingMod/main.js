Game.registerMod("addBuildingMod",{
	init:function(){
		// 初期化
		let _mod = this;
		this.buildsMax = 0; // 建物の数
		this.builds = []; // 建物リスト
		
		// タイトルを表示（消しても問題ない）
		l('products').insertAdjacentHTML('beforeend', `<div class="storePre" style="font-size:20px; padding:8px 0px;" id="abmTitle">AddBuildingMod</div>`);

		//----------------------------------------------------
		// ★建物を追加する
		// 	ex) this.addBuilding(名前, 説明, 初期価格, CpS, アイコンのファイル名※1);
		//		※1 /AddBuildMod/imgフォルダ内に画像を配置する
		//----------------------------------------------------
		this.addBuilding('クッキー', 'クッキーとクッキーからクッキーが生まれます。', 2, 1, 'build01.png');
		this.addBuilding('僕', '私です。', 7777, 777, 'build02.png');
		this.addBuilding('ロボット', 'クッキー手作りAI搭載ロボット！', 999999999, 523, 'build03.png');

		
		
		// CpS更新タイミングの処理を登録
		Game.registerHook('cps', function(cps){
			var _cps = 0;
			// 追加した建物のCpSを反映する
			for(var i = 0; i < _mod.buildsMax; i ++){
				var _me = _mod.builds[i];
				_me.storedTotalCps = _me.cps * _me.amount;
				_cps += _me.storedTotalCps;
			}
			return (cps + _cps);
		});

		// 毎周期の処理を登録
		Game.registerHook('logic', function(){
			for(var i = 0; i < _mod.buildsMax; i ++){
				_mod.builds[i].totalCookies += (_mod.builds[i].storedTotalCps * Game.globalCpsMult) / Game.fps;
			}
			
			if(Game.T % Game.fps == 0){	
				for(var i = 0; i < _mod.buildsMax; i ++){
					_mod.builds[i].refresh();
				}
			}
		});

		// 描画更新タイミングの処理を登録
		Game.registerHook('draw', function(){
			if (Game.drawT % 5 == 0){
				for (var i = 0; i < _mod.buildsMax; i ++){
					var _me = _mod.builds[i];
					var classes = 'product unlocked';
					if ((Game.buyMode == 1 && Game.cookies >= _me.bulkPrice) || (Game.buyMode == -1 && _me.amount > 0)) classes += ' enabled'; else classes += ' disabled';
					_me.l.className = classes;
				}
			}
		});

		// リセットタイミングの処理を登録
		Game.registerHook('reset', function(){
			for (var i = 0; i < _mod.buildsMax; i ++){
				var _me = _mod.builds[i];
				_me.amount=0;
				_me.totalCookies=0;
				_me.refresh();
			}
		});

		// ストア更新関数に追加した建物分も入れておく
		/* v0.999:関数を直接フックするとCCSEと競合が発生するため、'logic'へ移動
		var _origin = Game.RefreshStore;
		Game.RefreshStore = function(){
			_origin.apply();

			for(var i = 0; i < _mod.buildsMax; i ++){
				_mod.builds[i].refresh();
			}
		}
		*/
	},
	// セーブデータ書き出し
	save:function(){
		var str = '';
		for (var i = 0; i < this.buildsMax; i ++){
			var _me = this.builds[i];
			str += _me.amount + ',' + parseFloat(Math.floor(_me.totalCookies)) + ';';
		}
		return str;
	},
	// セーブデータ読み込み
	load:function(str){
		var spl = str.split(';');
		for(var i = 0; i < this.buildsMax; i ++){
			var _me = this.builds[i];
			if (spl[i]){
				var mestr = spl[i].toString().split(',');
				_me.amount = parseInt(mestr[0]);
				_me.totalCookies = parseFloat(mestr[1]);
			}
			else{
				_me.amount = 0;
				_me.totalCookies = 0;
			}
		}
	},
	// 建物を追加する関数
	addBuilding:function(name, desc, price, cps, img){
		// 初期化
		let _build = {
			id: this.buildsMax, name: name, desc: desc, price: price, cps: cps, img: img,
			amount: 0, basePrice: price, fortune: 0, bulkPrice: 0, totalCookies: 0, storedTotalCps: 0, l: 0,
			refresh: function(){}, rebuild: function(){}, sell: function(){}, getSellMultiplier: function(){},
			tooltip: function(){}, buy: function(){}, getPrice: function(){}, getSumPrice: function(){}, getReverseSumPrice: function(){},
		};

		// 価格更新
		_build.refresh = function()//show/hide the building display based on its amount, and redraw it
		{
			_build.price=_build.getPrice();
			if (Game.buyMode==1) _build.bulkPrice=_build.getSumPrice(Game.buyBulk);
			else if (Game.buyMode==-1 && Game.buyBulk==-1) _build.bulkPrice=_build.getReverseSumPrice(1000);
			else if (Game.buyMode==-1) _build.bulkPrice=_build.getReverseSumPrice(Game.buyBulk);
			_build.rebuild();
		}
		
		// 表示価格更新
		_build.rebuild=function()
		{
			var me=_build;
			var price=me.bulkPrice;

			if (Game.season=='fools')
			{
				// ビジネスデーの変化はなし
			}
			
			l('abmProductOwned'+me.id).textContent=me.amount?me.amount:'';
			l('abmProductPrice'+me.id).textContent=Beautify(Math.round(price));
			l('abmProductPriceMult'+me.id).textContent=(Game.buyBulk>1)?('x'+Game.buyBulk+' '):'';
			//l('productLevel'+me.id).textContent='lvl '+Beautify(me.level); // レベルは未実装
		}

		// 価格算出
		_build.getPrice = function()
		{
			var price = _build.basePrice * Math.pow(Game.priceIncrease, Math.max(0, _build.amount));
			price = Game.modifyBuildingPrice(_build, price);
			return Math.ceil(price);
		}

		// 複数購入価格算出
		_build.getSumPrice=function(amount)//return how much it would cost to buy [amount] more of this building
		{
			var price=0;
			for (var i=Math.max(0,_build.amount);i<Math.max(0,(_build.amount)+amount);i++)
			{
				price+=_build.basePrice*Math.pow(Game.priceIncrease,Math.max(0,i));
			}
			price=Game.modifyBuildingPrice(_build,price);
			return Math.ceil(price);
		}
		
		// 複数売却価格算出
		_build.getReverseSumPrice=function(amount)//return how much you'd get from selling [amount] of this building
		{
			var price=0;
			for (var i=Math.max(0,(_build.amount)-amount);i<Math.max(0,_build.amount);i++)
			{
				price+=_build.basePrice*Math.pow(Game.priceIncrease,Math.max(0,i));
			}
			price=Game.modifyBuildingPrice(_build,price);
			price*=_build.getSellMultiplier();
			return Math.ceil(price);
		}

		// 売却乗数算出
		_build.getSellMultiplier=function()
		{
			var giveBack=0.25;
			giveBack*=1+Game.auraMult('Earth Shatterer');
			return giveBack;
		}

		// 購入処理
		_build.buy = function(amount)
		{
			if (Game.buyMode == -1) {this.sell(Game.buyBulk,1); return 0;}
			var success = 0;
			if (!amount) amount = Game.buyBulk;
			if (amount == -1) amount = 1000;
			for (var i = 0; i < amount; i ++)
			{
				var price = _build.getPrice();
				if (Game.cookies >= price)
				{
					Game.Spend(price);
					_build.amount ++;
					//_build.bought ++; // 現状不要
					price = _build.getPrice();
					_build.price = price;
					Game.recalculateGains = 1;
					//_build.highest = Math.max(_build.highest, _build.amount); // 最大購入数
					Game.BuildingsOwned ++;
					success = 1;
				}
			}
			if (success) {PlaySound('snd/buy' + choose([1,2,3,4]) + '.mp3', 0.75); _build.refresh();}
		}
		
		// 売却処理
		_build.sell = function(amount)
		{
			var success=0;
			var sold=0;
			if (amount==-1) amount=_build.amount;
			if (!amount) amount=Game.buyBulk;
			for (var i=0;i<amount;i++)
			{
				var price=_build.getPrice();
				var giveBack=_build.getSellMultiplier();
				price=Math.floor(price*giveBack);
				if (_build.amount>0)
				{
					sold++;
					Game.cookies+=price;
					Game.cookiesEarned=Math.max(Game.cookies,Game.cookiesEarned); //this is to avoid players getting the cheater achievement when selling buildings that have a higher price than they used to
					_build.amount--;
					price=_build.getPrice();
					_build.price=price;
					Game.recalculateGains=1;
					Game.BuildingsOwned--;
					success=1;
				}
			}
			if (success && Game.hasGod)
			{
				var godLvl=Game.hasGod('ruin');
				var old=Game.hasBuff('Devastation');
				if (old)
				{
					if (godLvl==1) old.multClick+=sold*0.01;
					else if (godLvl==2) old.multClick+=sold*0.005;
					else if (godLvl==3) old.multClick+=sold*0.0025;
				}
				else
				{
					if (godLvl==1) Game.gainBuff('devastation',10,1+sold*0.01);
					else if (godLvl==2) Game.gainBuff('devastation',10,1+sold*0.005);
					else if (godLvl==3) Game.gainBuff('devastation',10,1+sold*0.0025);
				}
			}
			if (success && Game.shimmerTypes['golden'].n<=0 && Game.auraMult('Dragon Orbs')>0)
			{
				// ドラゴンオーブの対象外とする（誰も使ってないだろう）
				Game.Notify('AddBuildingMod', '追加した建物はドラゴンオーブの対象外です', [1,7]);
			}
			if (success) {PlaySound('snd/sell'+choose([1,2,3,4])+'.mp3',0.75); _build.refresh();}
		}

		// ツールチップ設定
		_build.tooltip = function(){
			var _me = _build;
			var canBuy=false;
			if ((Game.buyMode == 1 && Game.cookies >= _me.bulkPrice) || (Game.buyMode == -1 && _me.amount > 0)) canBuy = true;

			return (
			   `<div style="min-width:350px;padding:8px;">
					<div class="icon" style="float:left;margin-left:-8px;margin-top:-8px; background-position: ` + (-16 * 48) + `px ` + (-5 * 48) /* スパナアイコンで固定 */ + `px;"></div>
					<div style="float:right;text-align:right;">
						<span class="price ` + (canBuy? '': 'disabled') + `">` + Beautify(Math.round(_me.bulkPrice)) + `</span>` + Game.costDetails(_me.bulkPrice) + `
					</div>
					<div class="name">` + name + `</div>` + `
					<small>
						<div class="tag">` + loc("owned: %1", _me.amount) + `</div>` + `
					</small>` + `
					<div class="line"></div>
					<div class="description">` + desc + `</div>` +
					(_me.totalCookies > 0? (`
						<div class="line"></div>
						<div class="data">`+
							(_me.amount > 0? `&bull; ` + loc("each %1 produces <b>%2</b> per second", [_me.name, loc("%1 cookie", LBeautify((_me.storedTotalCps / _me.amount) * Game.globalCpsMult, 1))]) + `<br>`: ``) +
							`&bull; ` + loc("%1 producing <b>%2</b> per second", [_me.amount + _me.name, loc("%1 cookie", LBeautify(_me.storedTotalCps * Game.globalCpsMult, 1))]) + ` (` + loc("<b>%1%</b> of total CpS", Beautify(Game.cookiesPs > 0? ((_me.amount > 0? ((_me.storedTotalCps * Game.globalCpsMult) / Game.cookiesPs): 0) * 100): 0,1)) + `)<br>` +
							/*(synergiesStr? (`&bull; ` + synergiesStr + `<br>`): ``) +*/
							(EN? `&bull; <b>` + Beautify(_me.totalCookies) + `</b> ` + (Math.floor(_me.totalCookies) == 1? `cookie`: `cookies`) + `produced so far</div>`: `&bull; ` + loc("<b>%1</b> produced so far", loc("%1 cookie", LBeautify(_me.totalCookies))) + `
						</div>`)): ``
					) + `
				</div>`
			);
		}

		// HTML生成
		l('products').insertAdjacentHTML('beforeend',
		   `<div class="product unlocked enabled" onmouseout="Game.tooltip.shouldHide=1;" onmouseover="Game.tooltip.dynamic=1;Game.tooltip.draw(this,function(){return Game.mods['addBuildingMod'].builds[` + _build.id + `].tooltip();},'store')"; id="abmProduct` + _build.id + `">
				<div class="icon" id="abmProductIcon` + _build.id + `" style="background:url(../mods/workshop/AddBuildingMod/img/` + _build.img + `); background-size: 64px; background-position:0px 0px;"></div>
				<div class="content">
					<div class="title productName ` + ((name.length > 12 / Langs[locId].w)? 'longProductName': '') + `" id="abmProductName` + _build.id + `">` + _build.name + `</div>
					<span class="priceMult" id="abmProductPriceMult` + _build.id + `"></span>
					<span class="price" id="abmProductPrice` + _build.id + `">` + _build.price + `</span>
					<div class="title owned" id="abmProductOwned` + _build.id + `"></div>
				</div>
			</div>`
		);

		// クリック時のイベント登録
		_build.l = l('abmProduct' + _build.id);
		AddEvent(_build.l, 'click', function(){
			_build.buy(0);
		});
		
		this.builds.push(_build); // 建物リストに登録
		this.buildsMax ++;
	},
});
