/* 
 * Version: 0.9.5
 * 
 * TODO:
 * #> easier query managment
 * #> registration/userinfo from server
 * #> seearchbar: SearchBy requests on the server would work via a XSLT processor, which would also be used here, in the client, to filter already loaded results. then, when more pages are requested, we will pass SearchBy= and maybe StartWith= 
 * #> finish the filter buttons:
 * 		filter all the currently loaded apps and request LoadAppsByCategory to load the next page with Installed=True (and different div name); if we remove the filter, all the newly added 
 * 		(filter-added) get removed and the loading process (LoadAppsByCategory) continues without the Installed=True
 * 
 * 		basically, what is needed is to be able to modify LoadAppsByCategory's behavior on filter click and to undo it on request
 *		 REFACTORED USING LoadApps
 * 
 * #> better code organization
 * #> better truncating
 * #> a fancybox..box which shows applications when you click on them + all the info 
 * #> disqus
 * #> when searching, implement filters, paging, category integration 
 * #> infer installation from cookie
 * #> installation box: if there are more than 4 installations, display a link on the bottom (View all/Modify) else it would be only (Modify) and if the currently selected installation is not in top 4, bring it up
 * #> fix fade in-out effect of the home page in Chromium
 * #> fancybox login
 * #> if upgradeable, display old version
 * #> when installation is changed: reset (delete everything inside) #applications, return to home page
 * #> replace all the css-based hiding/showing with .hide() and .show()
 * #> server error message
 * #> maybe replace Toggle with SwitchToMain on back-button to prevent double clicking and staying in the same page
 * #> maybe show count of apps in every category
 * #> cancel button to work, maybe make log-out not refresh the page
 * #> logout
 * #> smaller screen view
 * #> change filters, categories, etc. when the installation is changed
 * #> fix multiple queries on search loading (one per app)
 * #> fix banned access to cookies
 * #> login/logout to update everything in the page without the need of refreshing
 * #> reload top rated on installation change
 * 
 * > packaging: remove all the external javascript scripts from the folder, but add them on building (Makefile?); split the style into a "linvo-webapp-styles" package
 * > re-factor some of the code and split it: remove all the text stuff from the CSS and the JS, so that translatable objects (text nodes) remain only in the DOM tree, remove most simpleweld()'s and 
 * 		manual welds from the main code, introduce the new server interface ( asynchronous requests, terminating existing requests sometimes when issuing new (e.g. search bar))
 * 		and split into several files; GetAppElement to use app ID and to cache elements ; or rather rename it to AppendAppElement and make it async
 * 		get rid of leaky variables
 * 
 * > GUI re-design; especially home page; remove apple magnifier on top; 
 * > ratings: http://colorpowered.com/colorrating/
 * > (!one more bug: when returning from filter searching, it must return to filter)
 * > on search, dynamically show/remove apps instead of reloading the whole thing
 * > notice is still not removed if you click on "System"
 * > a box to register an installation, infers type if it finds a word ("laptop", "tablet", "netbook") in the description/name
 * > login form to redirect to registration page
 * > there is still a bug with going back..if on second (or more) page, animations aren't proper; must scroll page to top before beginning second animation
 * > finish the full installation view, installation switching from there
 * > tooltips when cursor is on action icons
 * > translations
 * > apple-like toggles
 * > wait for disqus to load fully before doing a reset
 * > configuration (e.g. "show top rated", "show most used")
 * 
 * 2.0:
 * > "Statistics" page
 * #> JSONP
 * #> templating/welding, use $.create less, replace cases in which we apply the same function to two calls of jquery ($(...).smth(); $(...).smth()) to one $(..., ...).smth()
 * > remote desktop/control
 * > on filtering/searching, if some apps are faded out, smoothly bring the others in their place / fancy tile effects
 * #> use a class on all the elements that appear if the user is logged in, for faster displaying/hiding
 * > remove all the log-in stuff specific to PHPBB, move to server
 * > dynamic category reloading (using a sidebar)
 * > search "website" in the global Linvo changelog and see what I can adapt from there
 */

/* 
 * Basic skeleton definitions 
 * 
 * 
 * 
 * 
 */
apps_per_page = 8;
disqus_shortname = "linvo";
on_search_max_query = 100;

used_installation = $.cookie("linvo_installation");
if (!used_installation)
	used_installation = "main";

filters = 
{
	installed : { button_label: "Installed", filter_by_class: "Installed", server_query: "Installed=True" },
	upgrades : { button_label: "Upgrades", filter_by_class: "Upgradeable", server_query: "Installed=Upgradeable" }
}; 
 


/* 
 * Miscellanious functions for creating interfaces
 * e.g. create installation managment interface,
 * show my profile, etc.
 * 
 * 
 */
function ShowProfile()
{
	elem = "#profile-box";
	elem_link = "#profile-box-link";
	installations = "#Installations";
	
	if (ShowProfile.content_created)
	{
		$(elem_link).trigger("click");
		return;
	}
	
	QueryForeach(BuildServerQuery("UserInfo"),"UserInfo",function(profile) { $("#UserName").html(profile.UserName); });
	
	QueryForeach(BuildServerQuery("ListInstallations"),"Installation",function(installation) 
	{ 
		installation_elem = $("#installation-full-template").clone().simpleweld(installation,{"id":"title"});
		$(installation_elem).find("img").attr("src","icons/"+installation.Type+".png");
		upgrades_count = loadSimpleRequest(BuildServerQuery("List","Installation="+installation["@attributes"].id, "Installed=Upgradeable","PlainCount=True"));
		$(installation_elem).find(".UpgradesCount").html(upgrades_count[0]);

		if (installation["@attributes"].id == used_installation)
			$(installation_elem).find(".switch-installation").hide();

		$(installations).append(installation_elem);
	});
		
	$(elem_link).fancybox({
				"autoDimensions"	: false,
				"width"         		: 700,
				"height"        		: 500	
	});
	
	ShowProfile.content_created = true;
	$(elem_link).trigger("click");
}

SetupInstallationsBox.is_setup = false;
function SetupInstallationsBox()
{
	/* Listen carefully
	 * I shall execute this only once
	 */
	if (SetupInstallationsBox.is_setup)
		return;
	else 
		SetupInstallationsBox.is_setup = true;
		
	/* Set-up "View installations" button and load installations ; TODO: truncate descriptions
	 * */
	$("#installations-button").click(function() { ToggleButton(this); });
	$("#installations-button").toggle(function() { $("#installations-box").fadeIn('slow'); }, function() { $("#installations-box").fadeOut('slow'); } )
	
	installations_iter = 0;
	installations_count = QueryForeach(BuildServerQuery("ListInstallations"),"Installation",
		function(installation) 
		{ 
			is_selected_install = (installation["@attributes"].id == used_installation);

			if (installations_iter<4 || is_selected_install)
			{
				installation_div = $("#installation-template").clone().simpleweld(installation,{"id":"title"});
				$(installation_div).find("img").attr("src","icons/"+installation.Type+".png");
				
				if (installations_iter>=4)
				{
					$("#installations-box").prepend(installation_div);
					$("#installations-box").children().last().remove(); //pop last installation
				}
				else
					$("#installations-box").append(installation_div);

				if (is_selected_install)
					$(installation_div).addClass("installation-selected");
			}
			
			installations_iter++;
		}
	);
	manage_installations = $.create("div",{id: "manage-installations"},[installations_count > 4 ? "View all/Manage" : "Manage installations"]);
	$(manage_installations).button().click(ShowProfile);
	$("#installations-box").append(manage_installations);
	$(".InstallationsCount").html("("+installations_count+")");
	

	/* Use live handling in case we need to dynamically load an installation (if a lot of them are managed) 
	 * */
	$(".installation").live("click", function() 
	{
		$(".installation").removeClass("installation-selected");
		$(this).addClass("installation-selected"); 

		ServerQueryAppendKey("Installation",$(this).attr("title"));
		RefreshCentre();

		$(".applications-list").remove(); //clean everything inside applications
	});
}

/* show a full app in a fancybox window by ID */
function ShowAppByID(id)
{
	QueryForeach(BuildServerQuery("List","ID="+id),"Application",function(app)
	{

		$.fancybox(
			$(GetAppElement(app)).append($(disqus_thread).detach()).html(),
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
				this.page.identifier = app["@attributes"].id;  
				this.page.url = "http://linvo.org/#!"+app["@attributes"].id;
			  }
		});
	});
}

/* Truncate app descriptions by an DIV id in which there are .application div's (application-list) */
function TruncateAppsDescription(which_div)
{
	var i = 0;
	var paragraphs = $(app_list).get(0).getElementsByTagName("p");
	while (paragraph = paragraphs.item(i++)) 
	{
		if (paragraph.offsetHeight >= 55) 
		{
			$(paragraph).css("overflow","hidden").height(55);
			three_dots = $.create("div",{style: "padding-left: 128px; font-weight: bold; "},["..."]);
			$(paragraph).after(three_dots);
		}
	}
}

/* 
 * Functions that put data from the server into HTML format
 * and generally interfere with the interface of this web app
 * 
 * 
 * 
 * */
 
function GetAppElement(app)
{
	app_element = $("#application-template").clone().simpleweld(app,{"id":"title"});

	/* add classes */
	if (app.Installed != "False")
		$(app_element).addClass("Installed");

	if (app.Installed == "Upgradeable")
		$(app_element).addClass(app.Installed);

	/* the icon requires special attention in case it is SVG */
	if (typeof(app.Icon) == "string" && app.Icon.split('.').pop() == "svg")
		$(app_element).prepend($.create("object",{type: 'image/svg+xml',width: 128, height: 128,align: "left",data: "data:image/svg+xml,"+loadXMLDoc(server+app.Icon).responseText}));
	else
		$(app_element).prepend($.create("img",{src: ( typeof(app.Icon) == "string" ? server+app.Icon : server+"icons/NoImageAvailable.png" ) , width: 128, height: 128, align: "left"}));
	
	$(app_element).find(".ActionDownload").attr("href",app.Download);
	
	return app_element;
}

function AppendApp(app, where_to)
{
	$(where_to).append(GetAppElement(app));
}

/* 
 * Filter functions
 * 
 * "Filters" are the buttons you click in order to review
 * a specific set of apps, for example, "Installed", "Upgrades"
 * or the search bar
 * 
 */
function SetFilterItemCount(count, element, name)
{
	$(element).html(name+" ("+count+")");

	if (count == 0)
		$(element).addClass("inactive");
	else 
		$(element).removeClass("inactive");

}
	
function UpdateFilters()
{
	for (var key in filters)
	{
		SetFilterItemCount(
			QueryForeach(BuildServerQuery("List",(LoadAppsByCategory.last_category ? "Category="+LoadAppsByCategory.last_category : null),filters[key].server_query),"Application"),
			"#"+key+"-button",
			filters[key].button_label
		);
	}
}

function ApplyFilter(name)
{
	LoadApps(name); //load more apps, filtered

	/* filter existing */
	if (filters[name].filter_by_class)
		with_each_app = function()
		{
			if (!$(this).hasClass(filters[name].filter_by_class))
			{
				$(this).fadeOut("slow");
				$(this).addClass("filtered");
			}
		};
	
	/* always overwrites the previous if both specified */
	if (filters[name].filter_function)
		with_each_app = filters[name].filter_function;
	
	$(".application").each(with_each_app);
	
}

function LoadFilter(name)
{		
	LoadApps(name);	

	/* query the whole database for installed apps */
	SwitchToAppView();
			
}

function UndoFilters()
{
	$(".filtered").show();
	$(".filter-added").remove();
	
	ServerQueryRemoveKey("Installed"); //TODO: use actual server keys

}

/* 
 * Button-related functions
 * 
 * the basis of the filter buttons
 * 
 *  */
function UnclickButton(button)
{
		$(button).css("background-size",$(button).css("background-size").replace(" -"," ")); 
		$(button).removeClass("clicked");
}
	
function ClickButton(button)
{
		$(button).css("background-size",$(button).css("background-size").replace(" "," -")); /* change how the button looks */
		$(button).addClass("clicked");
}

function ToggleButton(button)
{		
	was_clicked = $(button).hasClass("clicked");
	
	if (was_clicked) 
		UnclickButton(button);
	else 
		ClickButton(button);
		
	return was_clicked;
}

/* Notifications stuff 
 * */
function Notice(text)
{
	$("#notice-text").html(null).html(text).fadeIn("slow"); /* begin with resetting HTML */
}

function RemoveNotice()
{
	$("#notice-text").fadeOut("slow");
}
	

/* Search bar related functions
 * 
 *  
 * 
 **/
function SearchBarReset()
{
	$("#search-bar").children().filter(":input").val("").trigger("blur"); /* reset the search bar and trigger a blur in order to bring back the default text; EDIT: don't b(link)lur!! */
	$("#search-bar-reset").hide();
	$("#search-results").hide();
}	

/* 
 * Switch between the 2 views: applications and main
 * 
 * 
 * 
 * */
function SwitchToAppView()
{
	ToggleMainSections.at = 1;

	$("#categories").hide("slow","swing",null);
	$("#back-button").fadeIn("slow");
	RemoveNotice();
}

function SwitchToMainView()
{
	ToggleMainSections.at = 0;

	$("#categories").show("slow","swing",UndoFilters); /* handler func: undo the filter buttons' operation */
	$("#back-button").fadeOut("slow");
	$("#ajax-loader-apps").fadeOut("slow");

	SearchBarReset();
	
	$(".applications-list").fadeOut("slow"); /* fade everything in apps out */
	
	/* Undo the applied filters, reset search and category, update the filter buttons and unclick them */
	UndoFilters();
	LoadAppsResetSearch();
	LoadAppsResetCategory();
	UpdateFilters();
	UnclickButton(".filter-button"); /* ensure this is always unclicked on the main section */
}

function ToggleMainSections()
{
	if (ToggleMainSections.at)
		SwitchToMainView();
	else
		SwitchToAppView();
}



/* 
 * Application loading
 *
 * universal functions
 * 
 */


/* A function to be called when 
 * 
 * a) we need to load applications from a specific category/filter
 * b) we need to load more applications from that category/filter, in which case we call it without arguments
 * c) searching: pass "search: blah blah"
 * 
 * */
function LoadApps(which_apps)
{
//	LoadApps.loadapps_func = LoadAppsByCategory;
	app_set = which_apps || LoadApps.last;

	if (filters[app_set])
		LoadApps.loadapps_func = LoadAppsFiltered;
	else if (app_set && app_set.split(":")[0] == "search")
		LoadApps.loadapps_func = LoadAppsSearched;
	else
		LoadApps.loadapps_func = LoadAppsByCategory;

	/* if which_apps is null, just bring the last one */
	if (!which_apps)
		which_apps = LoadApps.last;
	else
	{
		/* start with a blank page if we're changing what we're displaying */
		LoadApps.loadapps_func.page = 0;
		LoadApps.last = which_apps;
	}

	if (!which_apps) /* just a double-check, in case the last has not been set - we have not run the function with a category before */
		return;

	LoadApps.loadapps_func(which_apps);
	LoadApps.loadapps_func.page++; /* flip to next page */
	
}

/*
 * A function to reset the category 
 * 
 */
function LoadAppsResetCategory()
{
	LoadApps.last = null;
	LoadAppsByCategory.last_category = null;
	
	ServerQueryRemoveKey("Category");
}

/* 
 * A function to reset the filter
 * 
 * 
 * */
function LoadAppsResetFilter()
{
	LoadApps.loadapps_func = LoadAppsByCategory;
	LoadApps.last = LoadAppsByCategory.last_category;
	
}

/*
 * resetting search
 * almost the same as resetting a filter
 * 
 */
function LoadAppsResetSearch()
{
	LoadAppsSearched.last_searchby = null;
	
	LoadApps.loadapps_func = LoadAppsByCategory;
	LoadApps.last = LoadAppsByCategory.last_category;

	ServerQueryRemoveKey("SearchBy");
}

LoadAppsFiltered.page=0;
function LoadAppsFiltered(filter)
{
	if (LoadAppsFiltered.page==0)
		last_app = $(".applications-list:visible").not(".filter-added").children().last().attr("title");
	
	
	ServerQueryAppendKey(filters[filter].server_query);

	app_list = $.create("div",{class: "applications-list filter-added"});
	$(app_list).hide(); //invisibile by default

	
	query = BuildServerQuery("List","Page="+LoadAppsFiltered.page,"Limit="+apps_per_page, (last_app ? "StartWith="+last_app : null));
	QueryForeach(query,"Application",function(app) { AppendApp(app,app_list); });
		
	$("#applications").append(app_list);
	$(app_list).fadeIn("slow"); //so we can slowly show it
	TruncateAppsDescription(app_list);

}

LoadAppsByCategory.page=0;
function LoadAppsByCategory(category)
{
	ServerQueryAppendKey("Category",category);
	
	//if this is called we should reset the filters' page
	LoadAppsFiltered.page=0;
	
	LoadAppsByCategory.last_category = category;

	if (LoadAppsByCategory.page==0)
		UpdateFilters();
	
	/* if this DIV already exists, just show it */
	div_id = category+"-"+LoadAppsByCategory.page;
	if ($("#"+div_id).length > 0)
	{
		$("#"+div_id).fadeIn("slow");
		return;
	}

	app_list = $.create("div",{class: "applications-list", id: div_id});

	$(app_list).hide(); //invisibile by default
	
	QueryForeach(BuildServerQuery("List","Page="+LoadAppsByCategory.page,"Limit="+apps_per_page),"Application",function(app) { AppendApp(app,app_list); });
		
	$("#applications").append(app_list);
	$(app_list).fadeIn("slow"); //so we can slowly show it	
	TruncateAppsDescription(app_list);
}

LoadAppsSearched.page=0;
LoadAppsSearched.searchby = "";
function LoadAppsSearched(searchby)
{		
	if (searchby.match("^search:"))
		searchby = searchby.substr(("search:").length);

	if (searchby != LoadAppsSearched.searchby)
	{
		LoadAppsSearched.loaded_apps = loadSimpleRequest(BuildServerQuery("List","PlainList=True","Limit="+(on_search_max_query+1)));
		LoadAppsSearched.last_searchby = searchby;
		ServerQueryAppendKey("SearchBy",searchby); 
	}
	
	//TODO: if it is different, update the array and reset the paging; can be implemented in loadapps?
	//and then it can check if the page is 0 in which case the array would be updated
	
	//updating the array
	
	LoadAppsSearched.loaded_apps = loadSimpleRequest(BuildServerQuery("List","PlainList=True","Limit="+(on_search_max_query+1)));

	if (LoadAppsSearched.page==0)
		UpdateFilters();
	
	$("#search-results").show();
	suffix = (LoadAppsSearched.loaded_apps.length == 1 ? "" : "s");
	if (LoadAppsSearched.loaded_apps.length>on_search_max_query)
		$("#search-results").html("More than "+on_search_max_query+" result"+suffix+" found.");
	else if (LoadAppsSearched.loaded_apps.length==1 && LoadAppsSearched.loaded_apps[0] == "")
		$("#search-results").html("No results.");
	else
		$("#search-results").html(LoadAppsSearched.loaded_apps.length+" result"+suffix+".");
	
	app_list = $.create("div",{class: "applications-list searched-apps"});
	$(app_list).hide(); //invisibile by default

	
	/* TODO: re-do this method; copy the array, remove all the loaded apps, show them, and .slice it, pass it to the query. something like this */
	// $.each($(".searched-apps").children(),...)
	start = LoadAppsSearched.page*apps_per_page;
	queried_apps = new Array();
	for (var i=start; i!=(start+apps_per_page); i++)
	{
		/*matched_app = $(".application[title='"+LoadAppsSearched.loaded_apps[i]+"']");
		if (matched_app.length > 0)
			matched_app.show();
		else */
			queried_apps.push(LoadAppsSearched.loaded_apps[i]);
	}
	
	QueryForeach(BuildServerQuery("List","ID="+queried_apps.join(";")),"Application",function(app) { AppendApp(app,app_list); });

		
	$("#applications").append(app_list);
	$(app_list).fadeIn("slow"); //so we can slowly show it
	TruncateAppsDescription(app_list);

}



/* Category loading stuff 
 */
function LoadCategories()
{
	for (i in categories)
	{
		name = categories[i].name;
		friendlyName = categories[i].friendlyName ? categories[i].friendlyName : name;
		icon = categories[i].icon ? categories[i].icon : "icons/"+name+".png";
		
		category_link = $.create("a",{name: name, class: "navigation-link"});
		$(category_link).data("friendlyName",friendlyName);
		$("#categories").append(category_link);
		
		category_div = $.create("div",{class: "navigation-icon"});
		$(category_link).append(category_div);
		
		$(category_div).append($.create("img",{src: icon, width: 48, height: 48, class: "navigation-icon-img"}));
		$(category_div).append($.create("p",{},[friendlyName]));
	}
}

function UpdateCategoryInfo()
{
	$(".navigation-link, .navigation-link-unclickable").each(function()
	{
		name = $(this).attr("name");
		friendlyName = $(this).data("friendlyName");
		count = parseInt(loadSimpleRequest(BuildServerQuery("List","PlainCount=True","Category="+name))[0]);

		if (count == 0)
		{
			$(this).attr("class","navigation-link-unclickable");
			$(this).attr("rel","");
		}
		else 
		{	
			$(this).attr("class","navigation-link");
			$(this).attr("rel",count+" apps found in "+friendlyName+" category.");
		}
	});
}

/* Refresh the whole centre, e.g. after a login or installation change
 * 
 * called on: log in, log out, installation change
 */
function RefreshCentre()
{
	$.fancybox.close();
	UpdateFilters(); //is it really needed? in switchtomainview they're going to be updated anyway
	SwitchToMainView();
	UpdateCategoryInfo();
	
	/* Add top rated and newest 
	 * */
	$("#newest").empty();
	QueryForeach(BuildServerQuery("List","SortBy=DateCreated","Order=Descending","Limit=3"),"Application",function(app)
	{
		application_div = $.create("div",{class: "application application-mini", title: app["@attributes"].id},[app.Name+": "+app.Description.substring(0,30)+"..."]);
		$(application_div).prepend($.create("img",{src: server+app.Icon, width: 48, height: 48, align: "left"}));
		$("#newest").append(application_div);
	});
	
	$("#most-used").empty();
	app_ids = new Object();
	//QueryForeach(BuildServerQuery("Stats","Limit=3"),"Application",function(app) { app_ids[app["@attributes"].id] = app.InstallCount; });
	
	/* Show the elements that are only shown when logged in 
	 * */
	if (QueryForeach(BuildServerQuery("UserInfo"),"ID"))
	{
		UpdateFilters();
		$(".hide-on-login").hide();
		$(".show-on-login").show();
		SetupInstallationsBox();
	}
	else
	{
		$(".show-on-login").hide();
		$(".hide-on-login").show();
	}
}

/* Log-in function */
function LogIn()
{
	$(".empty-on-login").empty();
	
	var str = $("#login-form > form").serialize(); 
	str+="&login=Login&sid=";

	$.ajax({
		type: "POST",
		url: $(this).data("link"),  // Send the login info to this page
		data: str,
		success: function(data) 
		{
			$("#login-status").show();
			error_msg = $(data).find(".error").text();
			if (error_msg)
				$("#login-status").html("<span class='error-text'>"+error_msg+"</span>");
			else
			{
				$("#login-status").html("<p>Login successful!</p>");
				AuthKey = $(data).find(".icon-logout").children().attr("href");
				AuthKey = AuthKey.substring(AuthKey.indexOf("sid=")+4);
				$.cookie("AuthKey",AuthKey);
				ServerQueryAppendKey("AuthKey",AuthKey);
				
				setTimeout(RefreshCentre,1000);
			}	
		}
	});
}

function LogOut()
{
	$(".hide-on-logout").hide();
	
	$.get($(this).data("link"),{sid: AuthKey})
	.success(RefreshCentre)
	.error(function() { ErrorMessage("Log-out failed"); });
}

$(document).ready(function() 
{ 
	/* Categories comes from an external JSON file; load them
	 *  */
	LoadCategories();
	RefreshCentre();
	
	$("#other-apps").detach().appendTo("#categories");
	
	/* Interface stuff 
	 * */
	$(".navigation-link").click(function()
	{
		ToggleMainSections();
		LoadApps($(this).attr("name"),0);
	});
	
	//$(".navigation-link").addGlow({ haloColor: "black", radius: 100 });
	
	$(".navigation-link-unclickable").mouseenter(function() {
		Notice($(this).data("friendlyName")+": No applications belong to that category.");
	 });
	
	$(".navigation-link").mouseenter(function() {
		Notice($(this).attr("rel"));
	 });
	 
	$("#back-button").click(SwitchToMainView);
	
	$("#search-bar").show(); //must always be available, even if not logged in
	$("button, input:submit").button(); //style all the buttons and submit inputs using jquery UI
	
	/* Show a log-in box */
	$("#login-link").fancybox(
	{
				"autoDimensions"		: false,
				"width"         		: 280,
				"height"        		: 320
	});

	/* TODO: maybe transfer that to the HTML? */
	$("#login-submit").click(LogIn);
	$("#logout-button").click(LogOut);
	$("#cancel-button").click($.fancybox.close);
	
	
	
	/* Load disqus 
	 * */
	disqus_thread = $.create("div",{id: "disqus_thread"});
	$("#fancybox-content").append(disqus_thread);
	$.getScript("http://" + disqus_shortname + ".disqus.com/embed.js");

	/* Displays a full app in fancybox */
	$(".application").live("click", function(e)
	{ 
		/* Make sure we do not respond to clicking actions */
		if ($(e.target).parent().hasClass("Action"))
			return;
			
		ShowAppByID($(this).attr('title')); 
	});	/* use live handling; for obvious reasons */

	/* Actions */
	$(".ActionAdd").live("click",function()
	{
		$(this).parent().parent().addClass("Installed");
		/* TODO: request a server add */
	});

	$(".ActionRemove").live("click",function()
	{
		$(this).parent().parent().removeClass("Installed").removeClass("Upgradeable");
		/* TODO: request a server remove */
	});
	
	$(".ActionUpgrade").live("click",function()
	{
		$(this).parent().parent().removeClass("Upgradeable");
		/* TODO: request a server remove */
		/* TODO: request a server add */

	});
	
	/* Search bar 
	 * SearchBarEmpty: a function that is called when the search bar is empty/has to be emptied; deals with server queries and everything
	 * SearchBarReset (upper in the code) : simply resets the text box
	 * LoadAppsResetSearch (upper in the code): deals only with server queries
	 * */
	function SearchBarEmpty()
	{		
		if (LoadAppsByCategory.last_category)
		{
			SearchBarReset();
			
			/* been to a category page before searching; in which case display all the loaded pages that were shown (meaning all until LoadAppsByCategory.page) */
			$("div[id^='"+LoadAppsByCategory.last_category+"']").not(".searched-apps").slice(0,LoadAppsByCategory.page).show(); 
			$(".searched-apps").hide();
			LoadAppsResetSearch();
		}
		else
			SwitchToMainView(); /* been to main view before */
	}
	
	$("#search-bar").children().filter(":input").bind("input", function() 
	{
		var search_for = $(this).val();
		 
		if (search_for)
		{
			$(".searched-apps").hide(); //temporary
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
	$(".filter-button").click(function() 
	{  	

		if ($(this).hasClass("inactive"))
			return;
		
		name = $(this).attr("id").split("-")[0];
		
		/* if we were in an applications page, browsing a category; ToggleMainSections.at won't work because we need to know if a category is loaded */
		already_browsing_apps = LoadAppsByCategory.last_category || LoadAppsSearched.last_searchby;
		
		if (ToggleButton(this)) /* if it was clicked before, this function will return true */
		{
			/* Undoing filter */

			LoadAppsResetFilter();
			
			if (already_browsing_apps) 
				$(".filtered").fadeIn("slow",UndoFilters);	/* unfilter with an effect ; TODO: call UndoFilters only once */
			else
				SwitchToMainView(); /* else just go back */
		}
		else
		{
			/* Doing filter */
			UnclickButton($(".filter-button").not(this)); // Unclick the button of all other filters
			UndoFilters(); //undo previous filters 
			
			if (already_browsing_apps) 
				ApplyFilter(name); /* apply to the current results; TODO: NOTE: maybe undo previous filters? */
			else 
				LoadFilter(name);
		}
	});

	/* Finally, after everything has been loaded, check for permalink requests 
	 * */
	permalink_request = document.location.href.split("#")[1];
	if (permalink_request)
	{
		permalink_request = unescape(permalink_request);
		ShowAppByID(permalink_request);
	}
});

$(window).scroll(function()
{
	if  ($(window).scrollTop() == $(document).height() - $(window).height())
	{
	//	$("#ajax-loader-apps").detach().appendTo("#applications").show();
		LoadApps();
		//$("#ajax-loader-apps").hide();
	}
		/* TODO: show a rotating "loading" icon */
});
