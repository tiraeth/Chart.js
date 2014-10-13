(function(){
    "use strict";

    var root = this,
        Chart = root.Chart,
        helpers = Chart.helpers;

    var defaultConfig = {
        scaleShowGridLines : true,
        scaleGridLineColor : "rgba(0,0,0,.05)",
        scaleGridLineWidth : 1,
        bubbleMaxRadius : 30,
        bubbleMinRadius : 5,
        label: function(value){ return value; },
        xLabelBoundsOnly: false
    };

    Chart.Type.extend({
        name: "Bubble",
        defaults : defaultConfig,
        initialize:  function(data){
            this.BubbleClass = Chart.Ellipse.extend({
                strokeWidth: 1,
                showStroke: true,
                strokeColor: 'rgba(255,255,255,0.7)',
                fillColor: 'rgba(255,255,255,0.5)',
                ctx: this.chart.ctx,
            });

            this.getRadius = function(size, min, max){
                var span = this.options.bubbleMaxRadius - this.options.bubbleMinRadius,
                    r = Math.round(this.options.bubbleMinRadius + span/(max-min) * (size-min));

                return 0.5 + ((r % 2 == 0) ? r + 1 : r);
            };

            this.dataset = {
                fillColor : data.fillColor,
                strokeColor : data.strokeColor,
                bubbles : [],
                maxR: Math.max.apply(Math, data.data.map(function(p){ return p.r; })),
                minR: Math.min.apply(Math, data.data.map(function(p){ return p.r; })),
            };

            helpers.each(data.data,function(bubble,index){
                this.dataset.bubbles.push(new this.BubbleClass({
                    value : bubble.y,
                    size: bubble.r,
                    strokeColor : data.strokeColor,
                    fillColor : data.fillColor
                }));
            }, this);

            var self = this;

            this.buildScale(
                helpers.unique(data.data.map(function(p){
                    return parseFloat(p.x);
                })).sort(function(a, b){
                    return a-b
                }).map(self.options.label)
            );

            helpers.each(this.dataset.bubbles, function(bubble,index){
                helpers.extend(bubble, {
                    x: this.scale.calculateX(index),
                    y: this.scale.endPoint,
                    radius : this.options.bubbleMinRadius
                });

                bubble.save();
            }, this);

            this.render();
        },
        update : function(){
            this.scale.update();

            helpers.each(this.dataset.bubbles, function(bubble){
                bubble.save();
            }, this);

            this.render();
        },
        buildScale : function(labels){
            var self = this;

            var dataTotal = function(){
                var values = [];
                helpers.each(self.dataset.bubbles, function(bubble){
                    values.push(bubble.value);
                }, self);

                return values;
            };

            var scaleOptions = {
                templateString : this.options.scaleLabel,
                height : this.chart.height,
                width : this.chart.width,
                ctx : this.chart.ctx,
                textColor : this.options.scaleFontColor,
                fontSize : this.options.scaleFontSize,
                fontStyle : this.options.scaleFontStyle,
                fontFamily : this.options.scaleFontFamily,
                valuesCount : labels.length,
                beginAtZero : this.options.scaleBeginAtZero,
                integersOnly : this.options.scaleIntegersOnly,
                logarithmic: this.options.scaleLogarithmic,
                calculateYRange : function(currentHeight){
                    var updatedRanges = helpers.calculateScaleRange(
                        dataTotal(),
                        currentHeight,
                        this.fontSize,
                        this.beginAtZero,
                        this.integersOnly,
                        this.logarithmic
                    );
                    helpers.extend(this, updatedRanges);
                },
                xLabels : labels,
                xLabelBoundsOnly: this.options.xLabelBoundsOnly,
                font : helpers.fontString(this.options.scaleFontSize, this.options.scaleFontStyle, this.options.scaleFontFamily),
                lineWidth : this.options.scaleLineWidth,
                lineColor : this.options.scaleLineColor,
                gridLineWidth : (this.options.scaleShowGridLines) ? this.options.scaleGridLineWidth : 0,
                gridLineColor : (this.options.scaleShowGridLines) ? this.options.scaleGridLineColor : "rgba(0,0,0,0)",
                padding: 0,
                showLabels : this.options.scaleShowLabels,
                display : this.options.showScale
            };

            this.scale = new Chart.Scale(scaleOptions);
        },
        reflow : function(){
            var newScaleProps = helpers.extend({
                height : this.chart.height,
                width : this.chart.width
            });
            this.scale.update(newScaleProps);
        },
        draw : function(ease){
            var easingDecimal = ease || 1;
            this.clear();

            var ctx = this.chart.ctx;

            this.scale.draw(easingDecimal);

            helpers.each(this.dataset.bubbles, function(bubble, index){
                if (bubble.hasValue()){
                    bubble.transition({
                        y: this.scale.calculateY(bubble.value),
                        x: this.scale.calculateX(index),
                        radius: this.getRadius(bubble.size, this.dataset.minR, this.dataset.maxR)
                    }, easingDecimal);

                    bubble.draw();
                }
            }, this);
        }
    });


}).call(this);
