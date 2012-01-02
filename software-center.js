/* 
 * Version: 1.6.0
 * 
 * #> packaging: remove all the external javascript scripts from the folder, but add them on building (Makefile?); split the style into a "linvo-webapp-styles" package
 * #> re-factor and split code
 * #> on the CSS file, remove prefixed entries and use a prefix remover
 * #> on search, dynamically show/remove apps instead of reloading the whole thing
 * #> implement in LinvoAppServer.js > a timeout on every request after which a global ajax loader will be shown; + error page on server error
 * #> GUI re-design
 * #> login form to redirect to registration page
 * #> finish the full installation view, installation switching from there
 * > ratings: http://colorpowered.com/colorrating/
 * > a box to register an installation, infers type if it finds a word ("laptop", "tablet", "netbook") in the description/name
 * > there is still a bug with going back..if on second (or more) page, animations aren't proper; must scroll page to top before beginning second animation
 * > tooltips when cursor is on action icons
 * > translations
 * > apple-like toggles
 * > wait for disqus to load fully before doing a reset
 * 
 * 2.0:
 * > built-in integration with GNOME shell extensions and maybe android store if I can integrate android virtual machine into Linvo; possibly include {gtk,qt}-apps, but instead of packaging all those apps, add a "Request" button; this concept shall be called "sources"
 * > "users also viewed/installed"/similar
 * > social network integration, "send to" button
 * > proper mobile version (maybe with http://jquerymobile.com/) shipped as an app
 * > "Statistics" page
 * > "Open" and "Delete settings" buttons
 * > new full app view
 * > alternativeto integration?!
 * > remote desktop/control (puppet)
 * > on filtering/searching, if some apps are faded out, smoothly bring the others in their place / fancy tile effects
 * > 3D interface similar to HTC sense, ability to change views while on "applications" (4 column option if the screen is large enough)
 * > remove all the log-in stuff specific to PHPBB, move to server
 * > dynamic category reloading (using a sidebar)
 * > search "website" in the global Linvo changelog and see what I can adapt from there
 * > an ability for every app to have a custom tile, defined by a template from a server key
 * > optimizations: use a faster binding-to-DOM method, maybe use weld.js; or server-side templating, and maybe template-based truncating of descriptions (or anything that's faster);  a good idea would be to append elements in the time between the issuing of a server request and the response (use a counter incremented aftr element binding and after request response, if ==2, do simpleweld)
 * > as soon as the software center is opened, start preloading (using OnIdle? ) the first pages of all categories
 * > it might come in handy if all px values in the stylesheet are changed to cm values (automatically using a script)
 * > different kind of "syncers": e.g. classic lnvsync://, D-Bus syncing (if the app is authorized and used locally), Ubuntu syncing (APT); that would also require some additional server keys for every app (e.g. UbuntuPackages); also, Windows syncing would be great
 * NOTE: use underscore if needed
 */

/* 
 * Basic skeleton definitions 
 * 
 * 
 * 
 */

/* Constants */
apps_per_page = 8;
disqus_shortname = "linvo";
max_search_query = 100;

/* Server configuration */
linvoapp_server = new LinvoAppServer("/linvoapp-server");
linvoapp_server.baseParameters.AuthKey = $.cookie("AuthKey");

/* Filter configuration */
filters = 
{
	installed : { filter_class: "Installed", add_class: function(app) { return app.Installed==1; }, server_query: { Installed: 1 }},
	upgrades : { filter_class: "Upgradable", add_class: function(app) { return app.Upgradable==1; },server_query: { Upgradable: 1 }}
}; 
 
 /* Variables */
var request; /* Used for keeping track of current AJAX requests (and timeouts possibly) */
var filter_rule; /* A reference to a jQuery object that describes a CSS rule to use when filtering */
var scrollState = 0; /* Saves the scroll state in case we want to return back from a filter conveniently */
var searchCache = new Object(); /* an object used to cache DOM elements created during search */
var search_lastapps = [], search_applist;
var RefreshCentreCallbacks = [];
var userData;

/* Define the error callback */
linvoapp_server.errorCallback = function(jqXHR, textStatus)
{
	if (textStatus == "abort") return; /* Don't show error on abort */
	$.fancybox($("#server-error").html(),
	{
				"autoDimensions"	: false,
				"width"         		: 280,
				"height"        		: 320,
				"hideOnOverlayClick" : false,
				"showCloseButton"	: false
	});
}
linvoapp_server.timeOut = 10000;

/* show a full app in a fancybox window by ID */
function ShowAppByID(id)
{	
	linvoapp_server.List({ID: id},function(data)
	{
		$.fancybox(
			GetAppElement(data.Application).removeClass("application").addClass("application-large")[0].outerHTML+$(disqus_thread).detach().html(),
			{
				"autoDimensions"	: false,
				"width"         		: 800,
				"height"        		: 500
			}
		);
						
		DISQUS.reset({
		  reload: true,
		  config: function () 
			  { 
				this.page.identifier = data.Application["@attributes"].id;  
				this.page.url = "http://linvo.org/#!"+data.Application["@attributes"].id;
			  }
		});
	}).Apply();
}

/* Truncate app descriptions by an DIV id in which there are .application div's (application-list) */
function TruncateAppDesc(elem)
{
	var p = this.getElementsByTagName("p")[0];
	if (p.scrollHeight > p.offsetHeight)
		$(this).find(".tripledots").show();
}

/* 
 * Functions that put data from the server into HTML format
 * and generally interfere with the interface of this web app
 * 
 * 
 * */
 
function GetAppElement(app, template_used)
{
	var app_element = $("#templates").find(template_used ? template_used : ".application")
		.clone()
		.simpleweld(app,{"id":"data-id"});

	/* Add classes that later help the filters */
	$.each(filters, function(name,filter)
	{
		if (filter.add_class(app)) 
			app_element.addClass(filter.filter_class);
	});

	app_element.find(".Icon").attr("src",(typeof(app.Icon) == "string" ? linvoapp_server.baseURL+"/"+app.Icon : "graphics/icons/NoImageAvailable.png"));
	app_element.find(".ActionDownload").attr("href",app.Download);
	
	return app_element;
}

/* 
 * Filter functions
 * 
 * "Filters" are the buttons you click in order to review
 * a specific set of apps, for example, "Installed", "Upgrades"
 * or the search bar
 * 
 */
var updatefilters_req;
function UpdateFilters()
{
	if (updatefilters_req) updatefilters_req.abort();
	
	$.each(filters, function(key,filter)
	{
		updatefilters_req = linvoapp_server.List(
			$.extend({PlainCount: true},filter.server_query),
			function(count)
			{ 
				var button = $("#"+key+"-button")
					.setActive(!(count == 0))
					.find(".count").text(count);
			})
		.Apply();
	});
}	

function UndoFilters()
{
	filter_rule.text(""); /* Remove the css rule that filters apps */
	$(".filter-added").remove();
	
	/* Delete all the keys that the filters imposed from the base server query */
	$.each(filters,function() 
	{
		$.each(this.server_query, function(keyname) { delete linvoapp_server.baseParameters[keyname]; });
	});
}

/* Add an .IncrementFilter subroutine to every member of filters; change the filter count without re-polling the server ; used on install/remove/upgrade actions */
$.each(filters, function(key, filter)
{
	filter.IncrementFilter = function(number)
	{
		var filterElem = $("#"+key+"-button");
		var filterCountElem = filterElem.find(".count");
		var count = parseInt(filterCountElem.text())+number;
		filterCountElem.text(count);
		filterElem.setActive(!(count == 0));
	};
});	

/* Search bar related functions
 * just a utility to reset the serach bar
 **/
function SearchBarReset()
{	
	$("#search-bar-input").val("").trigger("blur"); /* reset the search bar and trigger a blur in order to bring back the default text; EDIT: don't b(link)lur!! */
	$("#search-bar-reset, #search-results").hide();
}	

/* 
 * Switch between the 2 views: applications and main
 * 
 * */
function SwitchToAppView()
{		
	$("#home-page").stop(true, true).hide("slow","swing",null);
	$("#back-button").stop(true, true).fadeIn("slow");
}

function SwitchToMainView()
{
	if (request) request.abort();

	$("#home-page").stop(true, true).show("slow","swing"); /* handler func: undo the filter buttons' operation */
	$("#back-button").stop(true, true).fadeOut("slow");
	
	$(".applications-list").hide();
	
	SearchBarReset();
		
	/* Undo the applied filters, reset search and category, update the filter buttons and unclick them */
	UndoFilters();
	LoadAppsResetFilter();
	LoadAppsResetSearch();
	LoadAppsResetCategory();
	UpdateFilters();
	$(".filter-button").removeClass("clicked"); /* ensure this is always unclicked on the main section */
}


/* Refresh the software centre
 * 
 * Also called on first load
 * 
 * */
function RefreshCentre()
{
	linvoapp_server.StopAll(); /* Make sure all requests are stopped */
	$(".applications-list:not(.searched-apps)").remove(); /* Clean all the application pages, except the one for searches, it stays forever */

	if (!(arguments[0] && arguments[0].skipCloseFancybox))
		$.fancybox.close();
	
	SwitchToMainView();
	
	/* Load categories */
	linvoapp_server.Categories({},function(data)
	{ 
		var categoriesElem = $("#categories");
		categoriesElem.empty(); /* Empty the categories element and add one instance of the template */
		$("#templates").find(".category").clone().appendTo("#categories").simpleweld(data.Category); /* Simpleweld the category array to it */
		
		categoriesElem.children().each(function()
		{ 
			$(this).find("img").attr("src","graphics/icons/"+$(this).find(".Name").text()+".png");  /* Set icons */
			$(this).setActive($(this).find(".ItemCount").text() != 0); /* Deactivate if item count is 0 */
		});
	}).Apply();
	
	/* This allows us to write plug-ins for the software center more easily */
	$.each(RefreshCentreCallbacks, function() { this() });

	/* (Re)load user info
	 * */
	if (arguments[0] && arguments[0].skipUserReload)
		return;
		
	linvoapp_server.UserInfo({},function(data)
	{
		if (data.ID)
		{
			userData = data;
			LoadInstallations();
			$("#profile-box").simpleweld(data);
			
			$(".hide-on-login").hide();
			$(".show-on-login").show();
		}
		else
		{
			$(".show-on-login").hide().removeClass("clicked"); /* In case an element was clicked before, on the previous logged-in session */
			$(".hide-on-login").show();
		}
	}).Apply();
}

$(document).ready(function() 
{ 
	filter_rule = $("<style>").appendTo("head");
	
	RefreshCentre();
		
	/* Interface stuff 
	 * */
	$(".category").live("click",function()
	{
		if ($(this).hasClass("inactive")) return;
		SwitchToAppView();
		LoadApps($(this).find(".Name").text(),0);
	});
	 	
	$("button, input:submit, .button").button(); //style all the buttons and submit inputs using jquery UI
	$(".fancyboxed").fancybox();
	
	/* Load disqus 
	 * */
	disqus_thread = $.create("div",{id: "disqus_thread"});
	$("#fancybox-content").append(disqus_thread);
	$.getScript("http://" + disqus_shortname + ".disqus.com/embed.js");

	/* Displays a full app in fancybox */
	$(".application").live("click", function(e) 	/* use live handling; for obvious reasons */
	{ 
		/* Make sure we do not respond to clicking actions */
		if ($(e.target).parent().hasClass("Action"))
			return;
			
		ShowAppByID($(this).data("id")); 
	});

	/* Actions */
	function SelectApp(clicked_on)
	{
		var app = $(clicked_on).closest(".application, .application-large");
		return app.add($(".application[data-id='"+app.data("id")+"']"));
	}
	
	$(".ActionAdd").live("click",function()
	{
		var app = SelectApp(this);
		
		app.addClass(filters.installed.filter_class);
		filters.installed.IncrementFilter(1);
		
		if (!userData.ID)
			return;
			
		linvoapp_server.Add({ID: app.data("id")},SyncLocal).Apply();
	});

	$(".ActionRemove").live("click",function()
	{
		var app = SelectApp(this);
		
		filters.installed.IncrementFilter(-1);
		if (app.hasClass(filters.upgrades.filter_class)) /* Also decrement the "Upgrades" button if it was in upgrades */
			filters.upgrades.IncrementFilter(-1);
		
		app.removeClass(filters.installed.filter_class).removeClass(filters.upgrades.filter_class);
		
		if (!userData.ID)
			return;
			
		linvoapp_server.Remove({ID: app.data("id")},SyncLocal).Apply();
	});
	
	$(".ActionUpgrade").live("click",function()
	{
		var app = SelectApp(this);
		
		app.removeClass(filters.upgrades.filter_class);
		filters.upgrades.IncrementFilter(-1);
		
		if (!userData.ID)
			return;
			
		linvoapp_server
			.Remove({ID: app.find(".Name").text()+" "+app.find(".InstalledVersion").text()})
			.Add({ID: app.data("id")},SyncLocal)
			.Apply();
	});
	
	$("#upgrade-all").click(function(e)
	{
		e.stopPropagation(); /* Don't react to filter button click event */
		
		var upgradeall_req;
		if (upgradeall_req && !upgradeall_req.LinvoAppServer.chainEnded)
			return;
			
		linvoapp_server.List($.extend({Keys: ["InstalledVersion", "ID"], StartWith: null},filters.upgrades.server_query),function(data)
		{
			/* Chain the requests, in pairs of remove/add, so that if the connection fails 
			* mid-request, you won't have all your apps removed and none added */
			var upgradeall_chain = linvoapp_server;
			
			linvoapp_server.each(data.Application, function(index,app)
			{				
				var appID = app["@attributes"].id;
				
				upgradeall_chain = upgradeall_chain
					.Remove({ID: app.Name+" "+app.InstalledVersion})
					.Add({ID: appID}, function() 
					{ 
						/* If the add call succeeds, reflect it in the interface */
						var upgradedAppElem = $(".application[data-id='"+appID+"']");
						if (upgradedAppElem.length == 0)
							return;
							
						upgradedAppElem.removeClass(filters.upgrades.filter_class); 
						filters.upgrades.IncrementFilter(-1);
					});
			});
			
			/* Issue a meaningless List request after everything, so that we can add a SyncLocal callback */
			upgradeall_req = upgradeall_chain.List({Limit: 1},SyncLocal).Apply();
		}).Apply();
	});
				
	/* Search bar 
	 * SearchBarEmpty: a function that is called when the search bar is empty/has to be emptied; deals with server queries and everything
	 * SearchBarReset (upper in the code) : simply resets the text box
	 * LoadAppsResetSearch (upper in the code): deals only with server queries
	 * */
	function SearchBarEmpty()
	{	
		search_lastapps = [];
		search_applist.hide();
		
		var browsed_filters = $(".filter-button").hasClass("clicked");
		if (linvoapp_server.baseParameters.Category || browsed_filters)
		{
			SearchBarReset();
			
			if (browsed_filters) /* been to a filter before searching; in which case display all the loaded pages marked with ".filter-added" */
				$(".applications-list").hide().parent().find(".filter-added").show();
			else /* been to a category page before searching; in which case display all the loaded pages that were shown (meaning all until LoadAppsByCategory.page) */
				$("div[id^='"+linvoapp_server.baseParameters.Category+"']").not(".searched-apps").slice(0,LoadAppsByCategory.page).show(); 
			
			LoadAppsResetSearch();
			UpdateFilters();
			SearchBarReset();
		}
		else
			SwitchToMainView(); /* been to main view before */
	}
	
	$("#search-bar-input").bind("input", function() 
	{
		var search_for = $(this).val();
		 
		if (search_for)
		{
			$("#search-bar-reset").show(); /* This is hidden when we SwitchToMainView */
			SwitchToAppView();
			$(".applications-list").not(".searched-apps").hide();
			LoadApps("search:"+search_for);
		}
		else 
			SearchBarEmpty();
	});
	
	$("#search-bar-reset").click(SearchBarEmpty);
	
	/* Filter magic 
	 * */
	$(".filter-button").click(function(e) 
	{  		
		var name = $(this).attr("id").split("-")[0];
		
		/* if we were in an applications page, browsing a category; ToggleMainSections.at won't work because we need to know if a category is loaded */
		var already_browsing_apps = linvoapp_server.baseParameters.Category || linvoapp_server.baseParameters.SearchBy;
		
		var was_clicked = $(this).hasClass("clicked");
		$(this).toggleClass("clicked"); /* Must toggle that now because we may need that information later */
		
		if (was_clicked)
		{
			/* Undoing filter */
			LoadAppsResetFilter();
			
			if (already_browsing_apps)
			{
				UndoFilters();
				
				window.scroll(0, scrollState);
				scrollState = 0;
			}
			else
				SwitchToMainView();
		}
		else
		{
			/* Doing filter */
			$(".filter-button").not(this).removeClass("clicked"); /* Unclick the button of all other filters */
			UndoFilters(); /* And undo the previous filters */
			
			if (!already_browsing_apps)
				SwitchToAppView();
			
			if (!scrollState)
				scrollState = $(window).scrollTop(); /* Save that for convenient return to a un-filtered page */
			
			filter_rule.text(".application:not(."+filters[name].filter_class+") {display: none;}"); /* Set a rule to apply to shown apps */	
			LoadApps(name); /* Load more apps, filtered */
		}
	});

	/* Finally, after everything has been loaded, check for permalink requests 
	 * */
	var permalink_request = document.location.href.split("#")[1];
	if (permalink_request)
	{
		permalink_request = unescape(permalink_request);
		ShowAppByID(permalink_request);
	}
});

$(window).scroll(function()
{
	if  ($(window).scrollTop() > ($(document).height() - $(window).height())*0.75 
			&& !(nextPageReq && !nextPageReq.LinvoAppServer.chainEnded))
		LoadApps();
});
