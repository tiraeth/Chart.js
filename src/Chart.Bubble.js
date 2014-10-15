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
        xLabelBoundsOnly: false,
        areaSelectionEnabled: false,
        areaSelectionCallback: helpers.noop
    };

    var SelectionArea = Chart.Element.extend({
        draw: function(){
            var ctx = this.ctx;

            if (!this.isVisible()) {
                this.rect = [0, 0, 0, 0];
                return;
            }

            var left = this.x,
                top = this.y,
                width = this.width,
                height = this.height;

            if (width < 0) {
                left = this.x + this.width;
                width = -this.width;
            }

            if (height < 0) {
                top = this.y + this.height;
                height = -this.height;
            }

            left = Math.round(left) + 0.5;
            top = Math.round(top) + 0.5;
            width = Math.round(width);
            height = Math.round(height);

            this.rect = [left, top, left + width, top + height];

            ctx.fillStyle = this.fillColor;
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;

            if (this.hover) {
                ctx.globalAlpha = 0.5;

                ctx.beginPath();
                ctx.moveTo(left + width - 3, top + 4);
                ctx.lineTo(left + width - 13, top + 14);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(left + width - 13, top + 4);
                ctx.lineTo(left + width - 3, top + 14);
                ctx.stroke();
            }

            ctx.beginPath();

            ctx.moveTo(0, 0);

            ctx.rect(left, top, width, height);
            ctx.fill();
            if (this.showStroke) {
                ctx.stroke();
            }

            ctx.globalAlpha = 1.0;
        },
        checkHover: function(x, y){
            var _hover = this.hover;
            this.hover = this.contains({ x: x, y: y });

            this.save();

            return _hover != this.hover;
        },
        isVisible: function(){
            return this.width != 0 && this.height != 0;
        },
        contains: function(point){
            return this.isVisible()
                && point.x >= this.rect[0] + 1
                && point.x <= this.rect[2] + 1
                && point.y >= this.rect[1] + 1
                && point.y <= this.rect[3] + 1;
        },
        inCorner: function(point){
            return this.isVisible()
                && point.x >= this.rect[2] - 20 + 1
                && point.x <= this.rect[2] + 1
                && point.y >= this.rect[1] + 1
                && point.y <= this.rect[1] + 20 + 1;
        }
    });

    Chart.Type.extend({
        name: "Bubble",
        defaults : defaultConfig,
        initialize:  function(data){
            this.BubbleClass = Chart.Ellipse.extend({
                strokeWidth: data.strokeWidth || 1,
                showStroke: (data.strokeWidth || 1) > 0,
                strokeColor: data.strokeColor || 'rgba(255,255,255,0.7)',
                fillColor: data.fillColor || 'rgba(255,255,255,0.5)',
                ctx: this.chart.ctx,
            });

            this.SelectionAreaClass = SelectionArea.extend({
                strokeWidth: 1,
                showStroke: true,
                strokeColor: data.selectionAreaStrokeColor || 'rgba(255,0,0,0.6)',
                fillColor: data.selectionAreaFillColor || 'rgba(255,0,0,0.3)',
                ctx: this.chart.ctx
            });

            this.getRadius = function(size, min, max){
                if (min == max) {
                    return 0.5 + this.options.bubbleMinRadius;
                }

                var span = this.options.bubbleMaxRadius - this.options.bubbleMinRadius,
                    r = Math.round(this.options.bubbleMinRadius + span * (size-min)/(max-min));

                r = 0.5 + ((r % 2 == 0) ? r + 1 : r);

                return r;
            };

            this.dataset = {
                fillColor : data.fillColor,
                strokeColor : data.strokeColor,
                bubbles : [],
                maxR: Math.max.apply(Math, data.data.map(function(p){ return p.r; })),
                minR: Math.min.apply(Math, data.data.map(function(p){ return p.r; })),
            };

            this.selectionAreas = [];
            this.selectionAreas.hovered = false;
            if (this.options.areaSelectionEnabled) {
                this.isSelecting = false;
                helpers.bindEvents(this, ['mousemove', 'click'], function(evt){
                    var mouse = helpers.getRelativePosition(evt);

                    if (evt.type == 'click') {
                        if (this.isSelecting) {
                            this.isSelecting = false;
                            this.chart.canvas.style.cursor = 'default';

                            this.options.areaSelectionCallback.call(this, this.selected());
                        } else {
                            var toRemove = [];
                            helpers.each(this.selectionAreas, function(area, index){
                                area.inCorner({x: mouse.x, y: mouse.y}) && toRemove.push(index);
                            }, this);

                            if (toRemove.length > 0) {
                                this.selectionAreas = this.selectionAreas.filter(function(area, index){
                                    return !area.isVisible() || toRemove.indexOf(index) == -1;
                                });

                                this.draw();
                                this.draw();

                                this.options.areaSelectionCallback.call(this, this.selected());
                            } else {
                                this.isSelecting = true;
                                this.chart.canvas.style.cursor = 'crosshair';

                                this.selectionAreas.push(new this.SelectionAreaClass({
                                    x: mouse.x,
                                    y: mouse.y,
                                    width: 0,
                                    height: 0
                                }));

                                this.draw();
                            }
                        }
                    } else {
                        if (this.isSelecting) {
                            var area = this.selectionAreas[this.selectionAreas.length-1];

                            helpers.extend(area, {
                                width: mouse.x - area.x,
                                height: mouse.y - area.y
                            });

                            area.save();
                            this.draw();
                        } else {
                            var changed = false;
                            helpers.each(this.selectionAreas, function(area){
                                changed = changed || area.checkHover(mouse.x, mouse.y);
                            }, this);

                            if (changed) {
                                this.draw();
                            }
                        }
                    }
                });
            }

            helpers.each(data.data,function(bubble,index){
                this.dataset.bubbles.push(new this.BubbleClass({
                    value : bubble.y,
                    id: bubble.id || index,
                    label: this.options.label(bubble.x),
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

            helpers.each(this.dataset.bubbles, function(bubble){
                helpers.extend(bubble, {
                    x: this.scale.calculateX(this.scale.xLabels.indexOf(bubble.label)),
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

            helpers.each(this.dataset.bubbles, function(bubble){
                if (bubble.hasValue()){
                    bubble.transition({
                        y: this.scale.calculateY(bubble.value),
                        x: this.scale.calculateX(this.scale.xLabels.indexOf(bubble.label)),
                        radius: this.getRadius(bubble.size, this.dataset.minR, this.dataset.maxR)
                    }, easingDecimal);

                    bubble.draw();
                }
            }, this);

            helpers.each(this.selectionAreas, function(area){
                area.draw();
            }, this);
        },
        selected: function(){
            var selected = [];
            helpers.each(this.selectionAreas, function(area){
                if (area.isVisible()) {
                    helpers.each(this.dataset.bubbles, function(bubble){
                        if (bubble.hasValue() && selected.indexOf(bubble.id) == -1 && area.contains(bubble)) {
                            selected.push(bubble.id);
                        }
                    }, this);
                }
            }, this);

            return selected;
        }
    });


}).call(this);
